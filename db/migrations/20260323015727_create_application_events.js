exports.up = async function (knex) {
  await knex.schema.createTable('application_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable()
      .references('id').inTable('applications').onDelete('CASCADE');
    table.specificType('from_status', 'app_status');
    table.specificType('to_status', 'app_status').notNullable();
    table.text('notes');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('application_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('application_events');
};