import mongoose from 'mongoose';
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import Settings from '@/models/Settings';
import { calculateShipping } from '@/lib/shipping';
import { productWeight } from '@/lib/weight';
import { isFreeShippingFor } from '@/lib/freeShipping';
import { sizeUnitPrice } from '@/lib/pricing';
import { evaluateCoupon } from '@/lib/coupon';

export class OrderError extends Error {}

// Pure read-only pricing + validation. Does NOT touch stock or coupon usage —
// safe to call many times (quote, Razorpay amount, final order creation).
// `shippingState` is the customer's delivery state (for state-wise shipping
// and per-product / per-combo free shipping).
//
// options.allowUndeliverable: when true (quote route) an undeliverable state
// does not throw; the result carries `deliverable: false` instead.
//
// Extra return values used by the quote route:
//   linePrices:     [{ index, price }]  server unit price per INPUT line
//   skippedIndexes: input lines that were ignored (deleted product, bad id...)
//
// Shipping weight uses the SAME rule as lib/cartWeight.js:
//   manual weight of the product / combo / pack if set (> 0),
//   else pieces x global weightPerPiece from Settings.
export async function buildOrderItemsAndTotals(
  items,
  couponCode,
  shippingState = '',
  { allowUndeliverable = false } = {}
) {
  let subtotal = 0;
  let totalPieces = 0;
  let shippingPieces = 0;
  let paidShippingLines = 0;
  const weightLines = [];
  const orderItems = [];
  const stockUpdateItems = [];
  const linePrices = [];
  const skippedIndexes = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const qty = Number(item.qty) || 0;
    if (qty < 1) continue;

    if (item.isCombo === true && item.comboId) {
      if (!mongoose.Types.ObjectId.isValid(item.comboId)) {
        skippedIndexes.push(idx);
        continue;
      }

      const combo = await Combo.findById(item.comboId);
      if (!combo || !combo.isActive) {
        throw new OrderError(`This combo is no longer available`);
      }

      // ───────────── Color-pack combo ─────────────
      if (combo.type === 'color-pack') {
        const packSize = Number(item.packDetails?.packSize);
        const pack = (combo.packOptions || []).find((p) => Number(p.size) === packSize);
        if (!pack) {
          throw new OrderError(`"${combo.name}" — selected pack is no longer available`);
        }

        const rawPicked = (item.packDetails?.colors || [])
          .filter((c) => Number(c.qty) > 0)
          .map((c) => ({ name: c.name, qty: Number(c.qty), size: c.size || item.size || '' }));

        const pickedTotal = rawPicked.reduce((s, c) => s + c.qty, 0);
        if (rawPicked.length === 0 || pickedTotal !== packSize) {
          throw new OrderError(`"${combo.name}" — please choose exactly ${packSize} pieces`);
        }
        if (rawPicked.some((c) => !c.size)) {
          throw new OrderError(`"${combo.name}" — please choose a size for every piece`);
        }

        const mergedMap = new Map();
        for (const c of rawPicked) {
          const key = `${c.name}||${c.size}`;
          const prev = mergedMap.get(key);
          if (prev) prev.qty += c.qty;
          else mergedMap.set(key, { ...c });
        }
        const picked = [...mergedMap.values()];

        if (pack.stock != null && pack.stock < qty) {
          throw new OrderError(`"${combo.name}" (Pack of ${packSize}) is out of stock`);
        }

        const baseProduct = await Product.findById(combo.baseProduct);
        if (!baseProduct || !baseProduct.isActive) {
          throw new OrderError(`"${combo.name}" is no longer available`);
        }

        const colorSummary = [];
        const colorStockUpdates = [];
        const needByColor = new Map();

        for (const c of picked) {
          const colorOpt = (combo.colors || []).find((o) => o.name === c.name);
          if (!colorOpt) {
            throw new OrderError(`"${combo.name}" — color ${c.name} is no longer available`);
          }

          const variant =
            (mongoose.Types.ObjectId.isValid(colorOpt.variantId) && baseProduct.variants.id(colorOpt.variantId)) ||
            baseProduct.variants.find(
              (v) => v.color?.toLowerCase().trim() === colorOpt.name.toLowerCase().trim()
            );
          const sizeEntry = variant?.sizes.find((s) => s.size === c.size);
          if (!variant || !sizeEntry) {
            throw new OrderError(`"${combo.name}" — ${c.name} is not available in size ${c.size}`);
          }

          const need = c.qty * qty;
          if (sizeEntry.stock < need) {
            throw new OrderError(`"${combo.name}" — ${c.name} (${c.size}) is out of stock`);
          }

          needByColor.set(c.name, (needByColor.get(c.name) || 0) + need);

          colorSummary.push(`${c.name} (${c.size}) x${c.qty}`);
          colorStockUpdates.push({
            isCombo: false,
            productId: String(baseProduct._id),
            variantId: String(variant._id),
            size: c.size,
            pantOptionId: null,
            shawlOptionId: null,
            qty: need
          });
        }

        for (const [colorName, need] of needByColor) {
          const colorOpt = (combo.colors || []).find((o) => o.name === colorName);
          if (colorOpt?.stock != null && colorOpt.stock < need) {
            throw new OrderError(`"${combo.name}" — ${colorName} is out of stock`);
          }
        }

        subtotal += pack.price * qty;
        totalPieces += packSize * qty;
        linePrices.push({ index: idx, price: pack.price });

        if (!isFreeShippingFor(combo, shippingState)) {
          shippingPieces += packSize * qty;
          paidShippingLines++;

          const perPieceGrams =
            Number(combo.pieceWeight) > 0 ? Number(combo.pieceWeight) : productWeight(baseProduct);
          weightLines.push({ unitGrams: perPieceGrams * packSize, pieces: packSize, qty });
        }

        const distinctSizes = [...new Set(picked.map((c) => c.size))];

        orderItems.push({
          product: baseProduct._id,
          comboId: combo._id,
          name: `${combo.name} (Pack of ${packSize})`,
          sku: '',
          image: combo.images?.[0] || '',
          color: colorSummary.join(', '),
          size: distinctSizes.join(', '),
          sleeveType: '',
          zipType: '',
          pantOption: null,
          shawlOption: null,
          price: pack.price,
          qty,
          isCombo: true,
          packDetails: {
            packSize,
            size: distinctSizes.join(', '),
            colors: picked.map((c) => ({ name: c.name, size: c.size, qty: c.qty }))
          }
        });

        stockUpdateItems.push(...colorStockUpdates);
        stockUpdateItems.push({
          isPackMeta: true,
          comboId: String(combo._id),
          packSize,
          qty,
          colors: [...needByColor.entries()].map(([name, need]) => ({ name, qty: need / qty }))
        });
        continue;
      }

      // ───────────── Multi-product combo ─────────────
      let subProductsWeight = 0;

      for (const sub of combo.products) {
        const subProduct = await Product.findById(sub.product);
        if (!subProduct || !subProduct.isActive) {
          throw new OrderError(`Combo "${combo.name}" is out of stock`);
        }

        subProductsWeight += productWeight(subProduct);

        if (sub.variantId && sub.size) {
          const subVariant = subProduct.variants.id(sub.variantId);
          const subSizeEntry = subVariant?.sizes.find((s) => s.size === sub.size);
          if (!subVariant || !subSizeEntry || subSizeEntry.stock < qty) {
            throw new OrderError(`Combo "${combo.name}" is out of stock`);
          }
        } else {
          const totalStock = (subProduct.variants || []).reduce(
            (sum, v) => sum + (v.sizes || []).reduce((s, z) => s + (z.stock || 0), 0),
            0
          );
          if (totalStock < qty) {
            throw new OrderError(`Combo "${combo.name}" is out of stock`);
          }
        }
      }

      const piecesPerCombo = Number(combo.piecesPerCombo) || combo.products?.length || 1;
      subtotal += combo.comboPrice * qty;
      totalPieces += piecesPerCombo * qty;
      linePrices.push({ index: idx, price: combo.comboPrice });

      if (!isFreeShippingFor(combo, shippingState)) {
        shippingPieces += piecesPerCombo * qty;
        paidShippingLines++;

        const comboUnitGrams = Number(combo.weight) > 0 ? Number(combo.weight) : subProductsWeight;
        weightLines.push({ unitGrams: comboUnitGrams, pieces: piecesPerCombo, qty });
      }

      orderItems.push({
        product: null,
        comboId: combo._id,
        name: combo.name,
        sku: combo.sku || '',
        image: combo.images?.[0] || combo.image || '',
        color: '',
        size: '',
        sleeveType: '',
        zipType: '',
        pantOption: null,
        shawlOption: null,
        price: combo.comboPrice,
        qty,
        isCombo: true
      });
      stockUpdateItems.push({ isCombo: true, comboProducts: combo.products, qty });
      continue;
    }

    // ───────────── Normal product line ─────────────
    if (!mongoose.Types.ObjectId.isValid(item.productId) || !mongoose.Types.ObjectId.isValid(item.variantId)) {
      skippedIndexes.push(idx);
      continue;
    }

    const product = await Product.findById(item.productId);
    if (!product) { skippedIndexes.push(idx); continue; }
    const variant = product.variants.id(item.variantId);
    if (!variant) { skippedIndexes.push(idx); continue; }
    const sizeEntry = variant.sizes.find((s) => s.size === item.size);
    if (!sizeEntry || sizeEntry.stock < qty) {
      throw new OrderError(`${product.name} (${variant.color}, ${item.size}) is out of stock`);
    }

    const sleeveType = item.sleeveType || '';
    const zipType = item.zipType || '';

    if (product.sleeveOptions?.length) {
      if (!sleeveType || !product.sleeveOptions.includes(sleeveType)) {
        throw new OrderError(`${product.name} — please select a valid sleeve type`);
      }
    }
    if (product.zipOptions?.length) {
      if (!zipType || !product.zipOptions.includes(zipType)) {
        throw new OrderError(`${product.name} — please select a valid zip type`);
      }
    }

    let pantOption = null;
    if (item.pantOption?.id) {
      const opt = product.pantOptions?.id(item.pantOption.id);
      if (!opt) {
        throw new OrderError(`${product.name} — selected pant option is no longer available`);
      }
      if (opt.stock < qty) {
        throw new OrderError(`${product.name} — ${opt.name} (pant) is out of stock`);
      }
      pantOption = opt;
    }

    let shawlOption = null;
    if (item.shawlOption?.id) {
      const opt = product.shawlOptions?.id(item.shawlOption.id);
      if (!opt) {
        throw new OrderError(`${product.name} — selected shawl option is no longer available`);
      }
      if (opt.stock < qty) {
        throw new OrderError(`${product.name} — ${opt.name} (shawl) is out of stock`);
      }
      shawlOption = opt;
    }

    // Per-size price wins over the variant price (see lib/pricing.js)
    const addonPrice = (pantOption?.price || 0) + (shawlOption?.price || 0);
    const unitPrice = sizeUnitPrice(variant, sizeEntry) + addonPrice;

    subtotal += unitPrice * qty;
    totalPieces += qty;
    linePrices.push({ index: idx, price: unitPrice });

    if (!isFreeShippingFor(product, shippingState)) {
      shippingPieces += qty;
      paidShippingLines++;
      weightLines.push({ unitGrams: productWeight(product), pieces: 1, qty });
    }

    orderItems.push({
      product: product._id,
      name: product.name,
      sku: sizeEntry.sku || product.sku || '',
      image: variant.images?.[0] || '',
      color: variant.color,
      size: item.size,
      sleeveType,
      zipType,
      pantOption: pantOption
        ? { optionId: pantOption._id, name: pantOption.name, image: pantOption.image || '', price: pantOption.price, sku: pantOption.sku || '' }
        : null,
      shawlOption: shawlOption
        ? { optionId: shawlOption._id, name: shawlOption.name, image: shawlOption.image || '', price: shawlOption.price, sku: shawlOption.sku || '' }
        : null,
      price: unitPrice,
      qty
    });
    stockUpdateItems.push({
      isCombo: false,
      productId: item.productId,
      variantId: item.variantId,
      size: item.size,
      pantOptionId: pantOption?._id || null,
      shawlOptionId: shawlOption?._id || null,
      qty
    });
  }

  if (!orderItems.length) throw new OrderError('No valid items in cart');

  // Same evaluator as /api/coupons/validate: identical rounding and rules.
  let discount = 0;
  let appliedCoupon = '';
  if (couponCode) {
    const c = await evaluateCoupon(couponCode, subtotal);
    if (c.valid) {
      discount = c.discount;
      appliedCoupon = c.code;
    }
  }

  const settings = await Settings.findOne({ key: 'global' }).lean();
  if (!settings) throw new OrderError('Store settings are not configured');

  const weightPerPiece = Number(settings.weightPerPiece) || 0;
  const totalWeightGrams = weightLines.reduce((sum, l) => {
    const unit = l.unitGrams > 0 ? l.unitGrams : l.pieces * weightPerPiece;
    return sum + unit * l.qty;
  }, 0);

  const discountedSubtotal = subtotal - discount;
  const shippingInfo = calculateShipping(settings, {
    subtotal: discountedSubtotal,
    totalQty: shippingPieces,
    totalWeightGrams,
    state: shippingState,
    allItemsFree: paidShippingLines === 0
  });

  if (!shippingInfo.deliverable && !allowUndeliverable) {
    throw new OrderError(`Sorry, we don't deliver to ${shippingInfo.state || 'this state'} yet`);
  }

  const shippingFee = shippingInfo.deliverable ? shippingInfo.shippingCost : 0;
  const total = Math.round(discountedSubtotal + shippingFee);

  return {
    orderItems,
    stockUpdateItems,
    subtotal,
    discount,
    appliedCoupon,
    shippingFee,
    total,
    totalPieces,
    totalWeightGrams,
    deliverable: shippingInfo.deliverable,
    shippingState: shippingInfo.state || '',
    freeShippingAbove: shippingInfo.freeShippingAbove,
    linePrices,
    skippedIndexes
  };
}