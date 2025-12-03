import Joi from 'joi';

export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation error',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  createUser: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().min(2).max(100).required(),
    role: Joi.string().valid('admin', 'user').default('user'),
    permissions: Joi.array().items(Joi.string()).default([]),
    password: Joi.string().min(6).required(),
    userUID: Joi.string().optional()
  }),

  updateUser: Joi.object({
    email: Joi.string().email().optional(),
    name: Joi.string().min(2).max(100).optional(),
    role: Joi.string().valid('admin', 'user').optional(),
    permissions: Joi.array().items(Joi.string()).optional(),
    password: Joi.string().min(6).optional()
  }),

  createTask: Joi.object({
    monthId: Joi.string().required(),
    userUID: Joi.string().optional(),
    boardId: Joi.string().optional(),
    dataTask: Joi.object().required()
  }),

  updateTask: Joi.object({
    dataTask: Joi.object().optional(),
    monthId: Joi.string().optional(),
    userUID: Joi.string().optional(),
    boardId: Joi.string().optional()
  }),

  createMonth: Joi.object({
    monthId: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
    yearId: Joi.string().pattern(/^\d{4}$/).required(),
    department: Joi.string().optional(),
    status: Joi.string().optional(),
    metadata: Joi.object().optional()
  })
};

