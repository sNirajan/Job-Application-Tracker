const { z } = require("zod");

// Optional text fields accept null so the edit form can clear them.
const optionalText = (max) => z.string().trim().max(max).nullable().optional();

const contactFields = {
  name: z.string().trim().min(1, "Name is required").max(255),
  title: optionalText(255),
  email: z.email("Enter a valid email").nullable().optional(),
  phone: optionalText(50),
  linkedin_url: z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" }).nullable().optional(),
  notes: z.string().nullable().optional(),
};

const createContactSchema = z.object(contactFields).strip();

const updateContactSchema = z
  .object({ ...contactFields, name: contactFields.name.optional() })
  .strip();

module.exports = { createContactSchema, updateContactSchema };
