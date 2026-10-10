import mongoose from 'mongoose';
import Product from '@/models/Product';
import Combo from '@/models/Combo';
import Coupon from '@/models/Coupon';
import Settings from '@/models/Settings';
import { genCouponCheck } from '@/lib/utils';
import { calculateShipping } from '@/lib/shipping';
import { productWeight } from '@/lib/weight';
import { isFreeShippingFor } from '@/lib/freeShipping';

export class OrderError extends Error {}

// Pure read-only pricing + validation. Does NOT touch stock or coupon usage —
// safe to call twice (once for the Razorpay amount, once at final order creation).
// `shippingState` is the customer's delivery state (for state-wise shipping
// and per-product / per-combo free shipping).
//
// Shipping weight uses the SAME rule as lib/cartWeight.js (the checkout estimate):
//   manual weight of the product / combo / pack if set (> 0),
//   else pieces x global weightPerPiece from Settings.
// Products and combos with free shipping (for this state) add no weight; if
// every line ships free, shipping is ₹0.
export async function buildOrderItemsAndTotals(items, couponCode, shippingState = '') {
  let subtotal = 0;
  let totalPieces = 0; // physical pieces in the order
  let shippingPieces = 0; // pieces that actually pay shipping (fallback weight)
  let paidShippingLines = 0; // lines that pay shipping (0 => everything ships free)
  const weightLines = []; // [{ unitGrams, pieces, qty }] resolved after settings load
  const orderItems = [];
  const stockUpdateItems = [];

  for (const item of items) {
    const qty = Number(item.qty) || 0;
    if (qty < 1) continue;

    if (item.isCombo === true && item.comboId) {
      if (!mongoose.Types.ObjectId.isValid(item.comboId)) continue;

      const combo = await Combo.findById(item.comboId);
      if (!combo || !combo.isActive) {
        throw new OrderError(`This combo is no longer available`);
      }

      // ───────────── Color-pack combo ─────────────
      // The customer can split ONE pack across colors AND sizes, e.g. a Pack of 5
      // = Red/M x2 + Red/L x1 + Blue/L x2. Each entry in packDetails.colors is
      // { name, qty, size }. Entries without a size (older carts) fall back to
      // the line's single `item.size`.
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

        // Merge duplicate color+size rows so stock is checked once per combination
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
        const needByColor = new Map(); // color name -> pieces needed across all sizes

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
          // The real garments always come out of the variant's size stock.
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

        // Admin-set color stock (when present) is a cap on the color across ALL sizes.
        for (const [colorName, need] of needByColor) {
          const colorOpt = (combo.colors || []).find((o) => o.name === colorName);
          if (colorOpt?.stock != null && colorOpt.stock < need) {
            throw new OrderError(`"${combo.name}" — ${colorName} is out of stock`);
          }
        }

        subtotal += pack.price * qty;
        totalPieces += packSize * qty;

        // Free-shipping packs (for this state) add nothing to billable weight.
        // To also treat a pack as free when its base product is free for the
        // state, use: isFreeShippingFor(combo, s) || isFreeShippingFor(baseProduct, s)
        if (!isFreeShippingFor(combo, shippingState)) {
          shippingPieces += packSize * qty;
          paidShippingLines++;

          // Pack weight = pieces x (combo.pieceWeight, else base product weight).
          // Size split doesn't change the weight.
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
        // Marker entry so orderService can deduct the combo's own pack stock
        // and admin-set color stock (aggregated per color, sizes combined).
        stockUpdateItems.push({
          isPackMeta: true,
          comboId: String(combo._id),
          packSize,
          qty, // number of packs sold
          colors: [...needByColor.entries()].map(([name, need]) => ({ name, qty: need / qty }))
        });
        continue;
      }

      // ───────────── Multi-product combo ─────────────
      let subProductsWeight = 0; // sum of the products' own weights (fallback for combo.weight)

      for (const sub of combo.products) {
        const subProduct = await Product.findById(sub.product);
        if (!subProduct || !subProduct.isActive) {
          throw new OrderError(`Combo "${combo.name}" is out of stock`);
        }

        subProductsWeight += productWeight(subProduct);

        if (sub.variantId && sub.size) {
          // Admin pinned an exact variant + size: check that stock.
          const subVariant = subProduct.variants.id(sub.variantId);
          const subSizeEntry = subVariant?.sizes.find((s) => s.size === sub.size);
          if (!subVariant || !subSizeEntry || subSizeEntry.stock < qty) {
            throw new OrderError(`Combo "${combo.name}" is out of stock`);
          }
        } else {
          // Nothing pinned: require enough total stock across all variants/sizes.
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

      // Free-shipping combos (for this state) add nothing to billable weight
      if (!isFreeShippingFor(combo, shippingState)) {
        shippingPieces += piecesPerCombo * qty;
        paidShippingLines++;

        // Combo weight = manual combo weight, else sum of its products' weights
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
      continue;
    }

    const product = await Product.findById(item.productId);
    if (!product) continue;
    const variant = product.variants.id(item.variantId);
    if (!variant) continue;
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

    // Pant / Shawl are optional add-ons ("None" is always valid). If the
    // client sent a selection it must resolve to a real, in-stock option.
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

    const addonPrice = (pantOption?.price || 0) + (shawlOption?.price || 0);
    const unitPrice = variant.price + addonPrice;

    subtotal += unitPrice * qty;
    totalPieces += qty;

    // Free-shipping products (for this state) add nothing to billable weight
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

  let discount = 0;
  let appliedCoupon = '';
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: genCouponCheck(couponCode), isActive: true });
    if (coupon && subtotal >= (coupon.minOrderValue || 0)) {
      if (!coupon.expiresAt || coupon.expiresAt > new Date()) {
        if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
          discount = coupon.type === 'percent' ? (subtotal * coupon.value) / 100 : coupon.value;
          if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
          appliedCoupon = coupon.code;
        }
      }
    }
  }

  // Shipping uses the SAME function as the checkout page's estimate route
  // (POST /api/admin/settings): real weight from product / combo weights
  // (fallback pieces x weightPerPiece), the customer's state for
  // state-wise rates / delivery blocking, and per-product / per-combo free shipping.
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

  if (!shippingInfo.deliverable) {
    throw new OrderError(`Sorry, we don't deliver to ${shippingInfo.state || 'this state'} yet`);
  }

  const shippingFee = shippingInfo.shippingCost;
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
    totalWeightGrams
  };
}