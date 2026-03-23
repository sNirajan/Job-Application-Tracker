exports.up = async function (knex) {
  // Enable UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // Create users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('name', 100).notNullable();
    table.timestamps(true, true); // created_at and updated_at with defaults
  });

  // Create status enum type
  await knex.raw(`
    CREATE TYPE app_status AS ENUM (
      'wishlist',
      'applied',
      'phone_screen',
      'technical',
      'onsite',
      'offer',
      'accepted',
      'rejected',
      'withdrawn'
    )
  `);

  // Create applications table
  await knex.schema.createTable('applications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('company', 255).notNullable();
    table.string('role', 255).notNullable();
    table.text('url');
    table.specificType('status', 'app_status').defaultTo('wishlist');
    table.integer('salary_min');
    table.integer('salary_max');
    table.string('location', 255);
    table.text('notes');
    table.date('applied_at');
    table.timestamps(true, true);

    // Indexes for common queries
    table.index('user_id');
    table.index(['user_id', 'status']);
    table.index(['user_id', 'applied_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('applications');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS app_status');
};