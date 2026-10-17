/**
 * File/folder validation schemas.
 */

const { z } = require('zod');

// Regex to prevent directory traversal and invalid characters
const FILE_NAME_REGEX = /^[a-zA-Z0-9_\-][a-zA-Z0-9_\-. ]*$/;

const createFileSchema = z.object({
  name: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be at most 255 characters')
    .regex(FILE_NAME_REGEX, 'File name contains invalid characters'),
  content: z
    .string()
    .default(''),
  language: z
    .string()
    .max(50)
    .optional(),
  folderId: z
    .string()
    .uuid('Invalid folder ID')
    .nullable()
    .optional(),
});

const updateFileSchema = z.object({
  name: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be at most 255 characters')
    .regex(FILE_NAME_REGEX, 'File name contains invalid characters')
    .optional(),
  content: z
    .string()
    .optional(),
  language: z
    .string()
    .max(50)
    .nullable()
    .optional(),
});

const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name must be at most 255 characters')
    .regex(FILE_NAME_REGEX, 'Folder name contains invalid characters'),
  parentId: z
    .string()
    .uuid('Invalid parent folder ID')
    .nullable()
    .optional(),
});

const updateFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name must be at most 255 characters')
    .regex(FILE_NAME_REGEX, 'Folder name contains invalid characters')
    .optional(),
  parentId: z
    .string()
    .uuid('Invalid parent folder ID')
    .nullable()
    .optional(),
});

const fileIdParamSchema = z.object({
  fileId: z.string().uuid('Invalid file ID'),
});

const folderIdParamSchema = z.object({
  folderId: z.string().uuid('Invalid folder ID'),
});

module.exports = {
  createFileSchema,
  updateFileSchema,
  createFolderSchema,
  updateFolderSchema,
  fileIdParamSchema,
  folderIdParamSchema,
};
