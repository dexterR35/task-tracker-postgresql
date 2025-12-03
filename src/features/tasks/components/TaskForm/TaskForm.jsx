import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAppDataContext } from '@/context/AppDataContext';
import { useCreateTask, useUpdateTask } from '@/features/tasks/tasksApi';
import { createFormSubmissionHandler, handleFormValidation, prepareFormData } from '@/utils/formUtils';
import { 
  createTaskFormSchema, 
  createTaskFormFields, 
  prepareTaskFormData,
} from '@/features/tasks/config/useTaskForm';
import { useDeliverablesOptions, useDeliverablesByDepartment } from '@/features/deliverables/DeliverablesManager';
import { 
  TextField, 
  TextareaField,
  SelectField, 
  MultiSelectField, 
  NumberField, 
  CheckboxField,
  SearchableDeliverablesField,
  SearchableSelectField,
  SimpleDateField,
  UrlField
} from '@/components/forms/components';

import DynamicButton from '@/components/ui/Button/DynamicButton';
import { logger } from '@/utils/logger';


const TaskForm = ({ 
  mode = 'create', 
  initialData = null, 
  monthId: propMonthId = null,
  onSuccess, 
  className = "" 
}) => {
  const { 
    reporters = [], 
    monthId: hookMonthId, 
    user: userData,
    currentMonth,
    selectedMonth,
    isCurrentMonth
  } = useAppDataContext();
  const [createTask] = useCreateTask();
  const [updateTask] = useUpdateTask();
  
  // Use prop monthId if provided, otherwise fall back to hook monthId
  const monthId = propMonthId || hookMonthId;
  
  // Check if the selected month has a board created
  const activeMonth = isCurrentMonth ? currentMonth : selectedMonth;
  const boardExists = activeMonth?.boardExists ?? false;
  const { deliverablesOptions, isLoading: loadingDeliverables } = useDeliverablesOptions();
  

  const dynamicSchema = createTaskFormSchema();
  
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
    resolver: yupResolver(dynamicSchema),
    defaultValues: {
      jiraLink: '',
      products: '',
      departments: '',
      markets: [],
      timeInHours: '',
      startDate: '',
      endDate: '',
      _hasDeliverables: false,
      deliverables: '',
      deliverableQuantities: {},
      variationsQuantities: {},
      variationsDeliverables: {},
      _usedAIEnabled: false,
      aiModels: [],
      aiTime: 0,
      isVip: false,
      reworked: false,
      useShutterstock: false,
      reporters: '',
      observations: ''
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  // Watch all form values for conditional field logic
  const watchedValues = watch();
  
  // Debug specific fields in edit mode (removed for production)
  
  // Watch reporters field for form logic
  const selectedReporter = watch('reporters');
  
  // Register dynamic fields once on mount
  useEffect(() => {
    register('deliverableQuantities');
    register('variationsQuantities');
    register('variationsDeliverables');
    
    // Initialize deliverableQuantities with empty object if not set
    const currentQuantities = watch('deliverableQuantities');
    if (!currentQuantities || Object.keys(currentQuantities).length === 0) {
      setValue('deliverableQuantities', {});
    }
  }, []); // Empty dependency array - only run once on mount

  // Watch the selected department to filter deliverables
  const selectedDepartment = watch('departments');
  const { deliverablesOptions: filteredDeliverablesOptions } = useDeliverablesByDepartment(selectedDepartment);

  // Create dynamic form fields with deliverables options (after filteredDeliverablesOptions is defined)
  const formFields = createTaskFormFields(filteredDeliverablesOptions);

  // Watch checkbox values to clear errors when unchecked
  const hasDeliverables = watch('_hasDeliverables');
  const usedAIEnabled = watch('_usedAIEnabled');

  // Clear validation errors and uncheck deliverables when checkbox is unchecked
  useEffect(() => {
    if (!hasDeliverables) {
      clearErrors('deliverables');
      // Uncheck all deliverables when "Has Deliverables" is unchecked
      setValue('deliverables', []);
    }
  }, [hasDeliverables, clearErrors, setValue]);

  // Clear deliverables selection when department changes
  useEffect(() => {
    // Only clear deliverables when department changes in create mode
    // Don't clear when editing existing tasks
    if (selectedDepartment && mode === 'create') {
      setValue('deliverables', '');
      clearErrors('deliverables');
    }
  }, [selectedDepartment, setValue, clearErrors, mode]);

  useEffect(() => {
    if (!usedAIEnabled) {
      clearErrors('aiModels');
      clearErrors('aiTime');
    }
  }, [usedAIEnabled, clearErrors]);

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && mode === 'edit') {
      // Handle nested data_task structure from database
      const taskData = initialData.data_task || initialData;
      
      // Reconstruct jiraLink from taskName for editing - ensure taskName is uppercase
      const jiraLink = taskData.taskName ? 
        `https://gmrd.atlassian.net/browse/${taskData.taskName.toUpperCase()}` : 
        (taskData.jiraLink || '');
      
      // Handle various date formats for form display
      const formatDate = (dateValue) => {
        if (!dateValue) return '';
        
        // If it's already a string in YYYY-MM-DD format, return as-is
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        
        // If it's an ISO string, convert to YYYY-MM-DD
        if (typeof dateValue === 'string' && dateValue.includes('T')) {
          return new Date(dateValue).toISOString().split('T')[0];
        }
        
        // If it's a timestamp object (backward compatibility)
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
          return dateValue.toDate().toISOString().split('T')[0];
        }
        
        // If it's a timestamp-like object with seconds (backward compatibility)
        if (dateValue.seconds) {
          return new Date(dateValue.seconds * 1000).toISOString().split('T')[0];
        }
        
        // If it's a Date object
        if (dateValue instanceof Date) {
          return dateValue.toISOString().split('T')[0];
        }
        
        return '';
      };
      
      const formattedStartDate = formatDate(taskData.startDate);
      const formattedEndDate = formatDate(taskData.endDate);
      
      
      const formData = {
        jiraLink: jiraLink,
        products: taskData.products || '',
        departments: Array.isArray(taskData.departments) ? taskData.departments[0] || '' : taskData.departments || '',
        markets: taskData.markets || null,
        timeInHours: taskData.timeInHours || '',
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        _hasDeliverables: !!(taskData.deliverablesUsed?.length || taskData.deliverables?.length),
        deliverables: (() => {
          // Get the first deliverable from deliverablesUsed
          const firstDeliverable = taskData.deliverablesUsed?.[0];
          if (import.meta.env.MODE === 'development') {
            logger.log('🔍 [TaskForm] Deliverables debug:', {
              taskData: taskData,
              deliverablesUsed: taskData.deliverablesUsed,
              firstDeliverable: firstDeliverable,
              filteredDeliverablesOptions: filteredDeliverablesOptions
            });
          }
          
          if (!firstDeliverable?.name) return null;
          
          // Find the matching option in filtered deliverables options
          const matchingOption = filteredDeliverablesOptions.find(opt => opt.value === firstDeliverable.name);
          if (matchingOption) {
            if (import.meta.env.MODE === 'development') {
              logger.log('🔍 [TaskForm] Found matching option:', matchingOption);
            }
            return firstDeliverable.name;
          }
          
          
          // Return the original name as fallback
          if (import.meta.env.MODE === 'development') {
            logger.log('🔍 [TaskForm] Using fallback name:', firstDeliverable.name);
          }
          return firstDeliverable.name;
        })(),
        deliverableQuantities: (() => {
          const quantities = {};
          if (taskData.deliverablesUsed?.length) {
            taskData.deliverablesUsed.forEach(deliverable => {
              if (deliverable.name && deliverable.count) {
                quantities[deliverable.name] = deliverable.count;
              }
            });
          } else if (taskData.deliverables?.[0]?.deliverableQuantities) {
            return taskData.deliverables[0].deliverableQuantities;
          }
          return quantities;
        })(),
        variationsQuantities: (() => {
          const quantities = {};
          if (taskData.deliverablesUsed?.length) {
            taskData.deliverablesUsed.forEach(deliverable => {
              if (deliverable.name && deliverable.variationsCount) {
                quantities[deliverable.name] = deliverable.variationsCount;
              }
            });
          } else if (taskData.deliverables?.[0]?.variationsQuantities) {
            return taskData.deliverables[0].variationsQuantities;
          }
          return quantities;
        })(),
        variationsDeliverables: (() => {
          const enabled = {};
          if (taskData.deliverablesUsed?.length) {
            taskData.deliverablesUsed.forEach(deliverable => {
              if (deliverable.name) {
                enabled[deliverable.name] = deliverable.variationsEnabled || false;
              }
            });
          } else if (taskData.deliverables?.[0]?.variationsDeliverables) {
            return taskData.deliverables[0].variationsDeliverables;
          }
          return enabled;
        })(),
        _usedAIEnabled: !!(taskData.aiUsed?.[0]?.aiModels?.length || taskData.aiModels?.length),
        aiModels: taskData.aiUsed?.[0]?.aiModels || taskData.aiModels || [],
        aiTime: taskData.aiUsed?.[0]?.aiTime || taskData.aiTime || 0,
        reporters: taskData.reporters || null,
        isVip: taskData.isVip || false,
        reworked: taskData.reworked || false,
        useShutterstock: taskData.useShutterstock || false,
        observations: taskData.observations || ''
      };
      
      
      // Reset form immediately - no delays needed
      if (import.meta.env.MODE === 'development') {
        logger.log('🔍 [TaskForm] Resetting form with data:', {
          deliverables: formData.deliverables,
          _hasDeliverables: formData._hasDeliverables,
          deliverableQuantities: formData.deliverableQuantities
        });
      }
      reset(formData);
      
      // Use useEffect to handle form state updates properly
      // This prevents race conditions and ensures proper form initialization
      
      
    }
  }, [initialData, mode, reset]);

  // Form state updates are now handled by the reset() call in the main useEffect
  // No additional useEffect needed since react-hook-form handles the state properly

  // Create standardized form submission handler
  const handleFormSubmit = createFormSubmissionHandler(
    async (data) => {
      // Check board existence before creating task (only for create mode)
      if (mode === 'create' && !boardExists) {
        const monthName = activeMonth?.monthName || monthId || 'selected month';
        throw new Error(
          `Cannot create task: Month board for ${monthName} has not been created. Please create the month board first before adding tasks.`
        );
      }
      
      // All validation is now handled by Yup schema - no redundant validation needed
      // Prepare form data for database
      if (import.meta.env.MODE === 'development') {
        logger.log('🔍 [TaskForm] Form submission data:', data);
      }
      const processedData = prepareTaskFormData(data, deliverablesOptions);
      if (import.meta.env.MODE === 'development') {
        logger.log('🔍 [TaskForm] Processed data for database:', processedData);
      }
      
      if (mode === 'edit' && initialData?.id) {
        // Update existing task
        if (import.meta.env.MODE === 'development') {
          logger.log('🔍 [TaskForm] Updating task:', {
            monthId: initialData.monthId || initialData.data_task?.monthId || monthId,
            taskId: initialData.id,
            processedData: processedData
          });
        }
          return await updateTask(
            initialData.monthId || initialData.data_task?.monthId || monthId,
            initialData.id,
            processedData,
            reporters,
            userData || {}
          );
      } else {
        // Create new task
        const taskWithMonthId = {
          ...processedData,
          monthId: monthId
        };
        
        return await createTask(
          taskWithMonthId,
          userData || {},
          reporters
        );
      }
    },
    {
      operation: mode === 'edit' ? 'update' : 'create',
      resource: 'task',
      onSuccess: async (result) => {
        // Close modal immediately for better UX
        onSuccess?.(result);
        
        reset();
        
      }
    }
  );

  const onSubmit = async (data) => {
    await handleFormSubmit(data, { reset, setError, clearErrors });
  };

  const handleFormError = (errors) => {
    handleFormValidation(errors, 'Task Form');
  };

  const formTitle = mode === 'edit' ? 'Edit Task' : 'Create New Task';
  const submitButtonText = mode === 'edit' ? 'Update Task' : 'Save Task';

  // Helper function to create field props
  const createFieldProps = (field) => ({
    field,
    register,
    errors,
    setValue,
    watch,
    trigger,
    clearErrors,
    formValues: watchedValues
  });

  // Helper function to render fields based on type
  const renderField = (field, fieldProps) => {
    if (field.name === 'deliverables') {
      return <SearchableDeliverablesField key={field.name} {...fieldProps} hideTimeInfo={true} />;
    }
    if (field.name === 'reporters') {
      return <SearchableSelectField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'hidden') {
      // Hidden fields don't need to be rendered visually
      return null;
    }
    if (field.type === 'select') {
      return <SelectField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'multiSelect') {
      return <MultiSelectField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'checkbox') {
      return <CheckboxField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'number') {
      return <NumberField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'date') {
      return <SimpleDateField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'textarea') {
      return <TextareaField key={field.name} {...fieldProps} />;
    }
    if (field.type === 'url') {
      return <UrlField key={field.name} {...fieldProps} />;
    }
    // Default to TextField
    return <TextField key={field.name} {...fieldProps} />;
  };

  // Helper function to render fields by name
  const renderFieldsByName = (fieldNames) => {
    return fieldsWithOptions
      .filter(field => fieldNames.includes(field.name))
      .map((field) => {
        const fieldProps = createFieldProps(field);
        return renderField(field, fieldProps);
      });
  };

  // Get fields with dynamic options (reporters and deliverables)
  const fieldsWithOptions = formFields.map(field => {
    if (field.name === 'reporters') {
      const reporterOptions = reporters?.map(reporter => ({
        value: reporter.reporterUID, // Use reporterUID field
        label: reporter.name, // Just the name for display
        name: reporter.name,
        email: reporter.email
      })) || null;
      
    
      return {
        ...field,
        options: reporterOptions
      };
    }
    if (field.name === 'deliverables') {
      // Use filtered deliverables based on selected department
      const deliverableOptions = filteredDeliverablesOptions?.map(deliverable => ({
        value: deliverable.value,
        label: deliverable.label,
        name: deliverable.label,
        department: deliverable.department,
        requiresQuantity: deliverable.requiresQuantity
      })) || null;
      
      return {
        ...field,
        options: deliverableOptions
      };
    }
    return field;
  });

  return (
    <div className={`p-5 w-full ${className}`}>
      <form onSubmit={handleSubmit(onSubmit, handleFormError)} className="space-y-4">
        {/* Basic Information Section */}
        <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Basic Information</h3>
          <div className="space-y-3">
            {/* Jira Link - Full Width */}
            <div>
              {renderFieldsByName(['jiraLink'])}
            </div>

            {/* Department + Product - 2 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderFieldsByName(['departments', 'products'])}
            </div>

            {/* Markets + Reporter - 2 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderFieldsByName(['markets', 'reporters'])}
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Timeline & Duration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {renderFieldsByName(['startDate', 'endDate', 'timeInHours'])}
          </div>
        </div>

        {/* Task Properties Section */}
        <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Task Properties</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {renderFieldsByName(['isVip', 'reworked', 'useShutterstock'])}
          </div>
        </div>

        {/* AI Configuration Section */}
        <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">AI Configuration</h3>
          <div className="space-y-3">
            {/* AI Used - Full Width */}
            <div>
              {renderFieldsByName(['_usedAIEnabled'])}
            </div>

            {/* AI Models + AI Time - 2 columns (conditional) */}
            {watchedValues._usedAIEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {renderFieldsByName(['aiModels', 'aiTime'])}
              </div>
            )}
          </div>
        </div>

        {/* Deliverables Section */}
        <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Deliverables</h3>
          <div className="space-y-3">
            {/* Has Deliverables - Full Width */}
            <div>
              {renderFieldsByName(['_hasDeliverables'])}
            </div>

            {/* Deliverables - Full Width (conditional) */}
            {watchedValues._hasDeliverables && (
              <div className="pt-1">
                <SearchableDeliverablesField
                  field={{
                    name: 'deliverables',
                    type: 'select',
                    label: 'Deliverables',
                    required: true,
                    options: filteredDeliverablesOptions || null
                  }}
                  register={register}
                  errors={errors}
                  setValue={setValue}
                  watch={watch}
                  trigger={trigger}
                  clearErrors={clearErrors}
                  formValues={watchedValues}
                  hideTimeInfo={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Additional Notes Section */}
        <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Additional Notes</h3>
          <div>
            {renderFieldsByName(['observations'])}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200/80 dark:border-gray-700/80">
          <DynamicButton
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            loading={isSubmitting}
            iconName={mode === 'create' ? 'add' : 'edit'}
            iconPosition="left"
            loadingText="Saving..."
            className="px-6 py-2"
          >
            {submitButtonText}
          </DynamicButton>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;

