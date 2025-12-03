import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { useDeliverablesApi } from './useDeliverablesApi';
import { useAuth } from '@/context/AuthContext';
import { handleValidationError } from '@/features/utils/errorHandling';
import { createFormSubmissionHandler, prepareFormData } from '@/utils/formUtils';
import { showSuccess } from '@/utils/toast';
import { VALIDATION } from '@/constants';
import { TASK_FORM_OPTIONS } from '@/features/tasks/config/useTaskForm';
import { 
  TextField, 
  NumberField, 
  SelectField,
  CheckboxField
} from '@/components/forms/components/';
import DynamicButton from '@/components/ui/Button/DynamicButton';
import { logger } from '@/utils/logger';

// ===== CONFIGURATION =====
const CONFIG = {
  FORM_FIELDS: [
    {
      name: "name",
      type: "text",
      label: "Deliverable Name",
      required: true,
      placeholder: "Enter deliverable name",
      validation: {
        required: VALIDATION.MESSAGES.REQUIRED,
        minLength: { value: VALIDATION.LIMITS.NAME_MIN, message: VALIDATION.MESSAGES.MIN_LENGTH(VALIDATION.LIMITS.NAME_MIN) },
        maxLength: { value: VALIDATION.LIMITS.NAME_MAX, message: VALIDATION.MESSAGES.MAX_LENGTH(VALIDATION.LIMITS.NAME_MAX) },
        pattern: { value: VALIDATION.PATTERNS.ALPHANUMERIC_SPACES, message: "Name can only contain letters, numbers, and spaces" }
      }
    },
    {
      name: "department",
      type: "select",
      label: "Department",
      required: true,
      options: TASK_FORM_OPTIONS.departments,
      validation: { required: VALIDATION.MESSAGES.REQUIRED }
    },
    {
      name: "timePerUnit",
      type: "number",
      label: "Time Per Unit",
      required: true,
      placeholder: "Enter time per unit",
      min: 0.1,
      max: 999,
      step: 0.1,
      validation: {
        required: VALIDATION.MESSAGES.REQUIRED,
        min: { value: VALIDATION.LIMITS.TIME_MIN, message: VALIDATION.MESSAGES.MIN_VALUE(VALIDATION.LIMITS.TIME_MIN) },
        max: { value: VALIDATION.LIMITS.TIME_MAX, message: VALIDATION.MESSAGES.MAX_VALUE(VALIDATION.LIMITS.TIME_MAX) }
      }
    },
    {
      name: "timeUnit",
      type: "select",
      label: "Time Unit",
      required: true,
      options: [
        { value: "min", label: "Minutes" },
        { value: "hr", label: "Hours" }
      ],
      validation: { required: VALIDATION.MESSAGES.REQUIRED }
    },
    {
      name: "variationsTime",
      type: "number",
      label: "Variations Time",
      required: false,
      placeholder: "Enter variations time (optional)",
      min: 0,
      max: 999,
      step: 0.1,
      validation: { min: { value: 0, message: "Variations time must be positive" } }
    },
    {
      name: "requiresQuantity",
      type: "checkbox",
      label: "Requires Quantity",
      required: false,
      validation: {}
    }
  ],
  MESSAGES: {
    CREATE_SUCCESS: 'Deliverable created successfully!',
    UPDATE_SUCCESS: 'Deliverable updated successfully!'
  }
};

// ===== FORM SCHEMA CREATOR =====
const createFormSchema = (fields) => {
  const schemaFields = {};
  fields.forEach(field => {
    let fieldSchema = field.type === 'number' ? Yup.number() : 
                     field.type === 'checkbox' ? Yup.boolean() : Yup.string();
    
    if (field.validation) {
      Object.keys(field.validation).forEach(rule => {
        if (rule === 'required' && field.validation[rule]) {
          fieldSchema = fieldSchema.required(field.validation[rule]);
        } else if (rule === 'minLength') {
          fieldSchema = fieldSchema.min(field.validation[rule].value, field.validation[rule].message);
        } else if (rule === 'maxLength') {
          fieldSchema = fieldSchema.max(field.validation[rule].value, field.validation[rule].message);
        } else if (rule === 'min') {
          fieldSchema = fieldSchema.min(field.validation[rule].value, field.validation[rule].message);
        } else if (rule === 'max') {
          fieldSchema = fieldSchema.max(field.validation[rule].value, field.validation[rule].message);
        } else if (rule === 'pattern') {
          fieldSchema = fieldSchema.matches(field.validation[rule].value, field.validation[rule].message);
        }
      });
    }
    schemaFields[field.name] = fieldSchema;
  });
  return Yup.object().shape(schemaFields);
};

// ===== DELIVERABLE FORM COMPONENT =====
const DeliverableForm = ({ 
  mode = 'create', 
  deliverable = null, 
  onSuccess, 
  onCancel, 
  className = "",
  user = null  // Add user prop
}) => {
  const { user: authUser } = useAuth();
  const { createDeliverable, updateDeliverable } = useDeliverablesApi();
  const [saving, setSaving] = React.useState(false);
  const schema = createFormSchema(CONFIG.FORM_FIELDS);
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting }, 
    reset, 
    watch, 
    setValue, 
    trigger, 
    clearErrors, 
    setError 
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: deliverable?.name || '',
      department: deliverable?.department || '',
      timePerUnit: deliverable?.timePerUnit || 1,
      timeUnit: deliverable?.timeUnit || 'hr',
      variationsTime: deliverable?.variationsTime || 0,
      requiresQuantity: deliverable?.requiresQuantity || false
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  const formValues = watch();
  const requiresQuantity = watch('requiresQuantity');

  // Watch for requiresQuantity changes and clear variationsTime if unchecked
  React.useEffect(() => {
    if (!requiresQuantity) {
      setValue('variationsTime', 0);
    }
  }, [requiresQuantity, setValue]);

  const handleFormSubmit = createFormSubmissionHandler(
    async (data) => {
      setSaving(true);
      try {
        const preparedData = prepareFormData(data);
        const userData = user || authUser;
        
        if (mode === 'create') {
          await createDeliverable(preparedData, userData);
        } else {
          if (!deliverable?.id) {
            throw new Error('Deliverable ID is required for update');
          }
          await updateDeliverable(deliverable.id, preparedData, userData);
        }
        
        // Show success toast manually to avoid double toast
        showSuccess(mode === 'create' ? CONFIG.MESSAGES.CREATE_SUCCESS : CONFIG.MESSAGES.UPDATE_SUCCESS);
        
        onSuccess?.();
        // No need to refetch - real-time listener will update automatically
      } catch (error) {
        logger.error('Error saving deliverable:', error);
        throw error;
      } finally {
        setSaving(false);
      }
    },
    { 
      setError, 
      clearErrors, 
      reset,
      operation: mode === 'create' ? 'create' : 'update', 
      resource: 'deliverable',
      showSuccessToast: false  // Disable automatic success toast
    }
  );

  const handleFormError = (errors) => handleValidationError(errors, 'deliverable');
  const handleCancel = () => { reset(); onCancel?.(); };

  return (
    <div className={`deliverable-form ${className} card`}>
      <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField field={CONFIG.FORM_FIELDS[0]} register={register} errors={errors} formValues={formValues} />
          <SelectField field={CONFIG.FORM_FIELDS[1]} register={register} errors={errors} formValues={formValues} />
          <NumberField field={CONFIG.FORM_FIELDS[2]} register={register} errors={errors} setValue={setValue} trigger={trigger} formValues={formValues} />
          <SelectField field={CONFIG.FORM_FIELDS[3]} register={register} errors={errors} formValues={formValues} />
          <NumberField 
            field={{
              ...CONFIG.FORM_FIELDS[4],
              disabled: !requiresQuantity
            }} 
            register={register} 
            errors={errors} 
            setValue={setValue} 
            trigger={trigger} 
            formValues={formValues} 
          />
          <CheckboxField field={CONFIG.FORM_FIELDS[5]} register={register} errors={errors} setValue={setValue} trigger={trigger} formValues={formValues} />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <DynamicButton type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </DynamicButton>
          <DynamicButton type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
            {mode === 'create' ? 'Create Deliverable' : 'Update Deliverable'}
          </DynamicButton>
        </div>
      </form>
    </div>
  );
};

export default DeliverableForm;
