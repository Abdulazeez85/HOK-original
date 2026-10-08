'use strict';

function buildProductQuery(filters = {}) {
  const query = {};
  const category = String(filters.category || '').trim();
  const brand = String(filters.brand || '').trim();
  const condition = String(filters.condition || '').trim();
  const ram = String(filters.ram || '').trim();
  const storage = String(filters.storage || '').trim();
  const maxPrice = Number(filters.maxPrice);
  const search = String(filters.search || '').trim();
  const tier = String(filters.tier || '').trim();

  if (category) query.category = category;
  if (brand) query.brand = brand;
  if (condition) query['specs.condition'] = condition;
  if (ram) query['specs.ram'] = ram;
  if (storage) query['specs.storage'] = storage;
  if (Number.isFinite(maxPrice) && maxPrice >= 0) query.price = { $lte: maxPrice };
  if (tier === 'bronze') query.price = { ...query.price, $gte: 0, $lt: 200000 };
  if (tier === 'silver') query.price = { ...query.price, $gte: 200000, $lte: 500000 };
  if (tier === 'gold') query.price = { ...query.price, $gt: 500000, $lte: 1000000 };
  if (tier === 'diamond') query.price = { ...query.price, $gte: 1000000 };

  if (search) {
    query.$or = [
      { brand: new RegExp(search, 'i') },
      { 'specs.cpu': new RegExp(search, 'i') },
      { 'specs.ram': new RegExp(search, 'i') },
      { 'specs.storage': new RegExp(search, 'i') },
      { 'specs.display': new RegExp(search, 'i') },
      { 'specs.condition': new RegExp(search, 'i') }
    ];
  }

  return query;
}

module.exports = { buildProductQuery };
