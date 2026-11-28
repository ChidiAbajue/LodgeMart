// Production-safe seed: zones, hubs, batch slots, products only (see seed.js).
process.env.SEED_MODE = 'reference';
await import('./seed.js');
