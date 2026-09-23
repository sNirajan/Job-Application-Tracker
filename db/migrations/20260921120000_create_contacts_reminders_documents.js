exports.up = async function (knex) {
  // People connected to an application (recruiter, hiring manager, interviewer)
  await knex.schema.createTable('contacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable()
      .references('id').inTable('applications').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('title', 255);
    table.string('email', 255);
    table.string('phone', 50);
    table.text('linkedin_url');
    table.text('notes');
    table.timestamps(true, true);

    table.index('application_id');
  });

  // Follow-up reminders. completed_at is null while the reminder is open.
  await knex.schema.createTable('reminders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable()
      .references('id').inTable('applications').onDelete('CASCADE');
    table.timestamp('remind_at', { useTz: true }).notNullable();
    table.text('note');
    table.timestamp('completed_at', { useTz: true });
    table.timestamps(true, true);

    table.index('application_id');
    table.index(['remind_at', 'completed_at']);
  });

  await knex.raw(`
    CREATE TYPE document_kind AS ENUM ('resume', 'cover_letter', 'other')
  `);

  // File metadata only. The file itself lives in storage (local disk or S3)
  // under storage_key, which never contains user-supplied text.
  await knex.schema.createTable('application_documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('application_id').notNullable()
      .references('id').inTable('applications').onDelete('CASCADE');
    table.specificType('kind', 'document_kind').notNullable().defaultTo('resume');
    table.string('original_name', 255).notNullable();
    table.string('mime_type', 100).notNullable();
    table.integer('size_bytes').notNullable();
    table.string('storage_key', 500).notNullable().unique();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index('application_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('application_documents');
  await knex.raw('DROP TYPE IF EXISTS document_kind');
  await knex.schema.dropTableIfExists('reminders');
  await knex.schema.dropTableIfExists('contacts');
};
