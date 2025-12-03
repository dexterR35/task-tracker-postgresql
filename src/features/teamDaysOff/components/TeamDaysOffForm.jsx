import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import { useTeamDaysOff } from '../teamDaysOffApi';
import { useAppDataContext } from '@/context/AppDataContext';
import { useUsers } from '@/features/users/usersApi';
import { useAuth } from '@/context/AuthContext';
import { handleValidationError } from '@/features/utils/errorHandling';
import { createFormSubmissionHandler, prepareFormData } from '@/utils/formUtils';
import { showSuccess } from '@/utils/toast';
import { VALIDATION } from '@/constants';
import { 
  TextField, 
  NumberField, 
  SearchableSelectField,
} from '@/components/forms/components/';
import DynamicButton from '@/components/ui/Button/DynamicButton';
import { logger } from '@/utils/logger';

// ===== CONFIGURATION =====
const CONFIG = {
  FORM_FIELDS: [
    {
      name: "userUID",
      type: "searchableSelect",
      label: "User",
      required: true,
      placeholder: "Select a user",
      validation: { required: VALIDATION.MESSAGES.REQUIRED }
    },
    {
      name: "baseDays",
      type: "number",
      label: "Base Days",
      required: true,
      placeholder: "Enter base days",
      min: 0,
      max: 100,
      step: 0.25,
      validation: {
        required: VALIDATION.MESSAGES.REQUIRED,
        min: { value: 0, message: VALIDATION.MESSAGES.MIN_VALUE(0) },
        max: { value: 100, message: VALIDATION.MESSAGES.MAX_VALUE(100) }
      }
    },
    {
      name: "daysOff",
      type: "number",
      label: "Days Off (Used)",
      required: true,
      placeholder: "Enter days off",
      min: 0,
      max: 100,
      step: 0.25,
      validation: {
        required: VALIDATION.MESSAGES.REQUIRED,
        min: { value: 0, message: VALIDATION.MESSAGES.MIN_VALUE(0) },
        max: { value: 100, message: VALIDATION.MESSAGES.MAX_VALUE(100) }
      }
    },
  ],
  MESSAGES: {
    CREATE_SUCCESS: 'Team days off entry created successfully!',
    UPDATE_SUCCESS: 'Team days off entry updated successfully!'
  }
};

// ===== FORM SCHEMA CREATOR =====
const createFormSchema = (fields) => {
  const schemaFields = {};
  fields.forEach(field => {
    let fieldSchema = field.type === 'number' ? Yup.number() : Yup.string();
    
    if (field.validation) {
      Object.keys(field.validation).forEach(rule => {
        if (rule === 'required' && field.validation[rule]) {
          fieldSchema = fieldSchema.required(field.validation[rule]);
        } else if (rule === 'min') {
          fieldSchema = fieldSchema.min(field.validation[rule].value, field.validation[rule].message);
        } else if (rule === 'max') {
          fieldSchema = fieldSchema.max(field.validation[rule].value, field.validation[rule].message);
        }
      });
    }
    schemaFields[field.name] = fieldSchema;
  });
  return Yup.object().shape(schemaFields);
};

// ===== TEAM DAYS OFF FORM COMPONENT =====
const TeamDaysOffForm = ({ 
  mode = 'create', 
  teamDaysOff = null,
  initialUserId = null,
  onSuccess, 
  onCancel, 
  className = "",
}) => {
  const { user: authUser } = useAuth();
  const { createTeamDaysOff } = useTeamDaysOff();
  const appData = useAppDataContext();
  const { users: contextUsers = [] } = appData || {};
  // Fallback to direct API call if context doesn't have users (for non-admins)
  const { users: apiUsers = [] } = useUsers();
  const users = contextUsers.length > 0 ? contextUsers : apiUsers;
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
      userUID: teamDaysOff?.userUID || teamDaysOff?.user_UID || teamDaysOff?.userId || initialUserId || '',
      baseDays: teamDaysOff?.baseDays || teamDaysOff?.base_days || 0,
      daysOff: teamDaysOff?.daysOff || teamDaysOff?.days_off || 0,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });
  
  // Set initial user ID if provided and form is in create mode
  React.useEffect(() => {
    if (mode === 'create' && initialUserId && !teamDaysOff) {
      setValue('userUID', initialUserId);
    }
  }, [mode, initialUserId, teamDaysOff, setValue]);

  const formValues = watch();
  const selectedUserUID = watch('userUID');

  // Get user name from selected user UID
  React.useEffect(() => {
    if (selectedUserUID && users.length > 0) {
      const selectedUser = users.find(u => u.userUID === selectedUserUID || u.id === selectedUserUID);
      if (selectedUser && mode === 'create') {
        setValue('userName', selectedUser.name);
      }
    }
  }, [selectedUserUID, users, setValue, mode]);

  const handleFormSubmit = createFormSubmissionHandler(
    async (data) => {
      setSaving(true);
      try {
        const preparedData = prepareFormData(data);
        
        // Find user to get name
        const selectedUser = users.find(u => u.userUID === preparedData.userUID || u.id === preparedData.userUID);
        if (!selectedUser) {
          throw new Error('Selected user not found');
        }

        const userData = {
          userUID: selectedUser.userUID || selectedUser.id,
          userName: selectedUser.name,
          baseDays: parseFloat(preparedData.baseDays) || 0,
          daysOff: parseFloat(preparedData.daysOff) || 0,
        };
        
        // Always use create - it handles updates via ON CONFLICT using user_UID
        // This way we don't need to worry about having the id
        await createTeamDaysOff(userData, authUser);
        
        showSuccess(mode === 'create' ? CONFIG.MESSAGES.CREATE_SUCCESS : CONFIG.MESSAGES.UPDATE_SUCCESS);
        
        onSuccess?.();
      } catch (error) {
        logger.error('Error saving team days off:', error);
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
      resource: 'team days off',
      showSuccessToast: false
    }
  );

  const handleFormError = (errors) => handleValidationError(errors, 'team days off');
  const handleCancel = () => { reset(); onCancel?.(); };

  // Prepare user options for searchable select
  const userOptions = users.map(user => ({
    value: user.userUID || user.id,
    label: user.name || user.email
  }));

  return (
    <div className={`team-days-off-form ${className} card p-6`}>
      <form onSubmit={handleSubmit(handleFormSubmit, handleFormError)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelectField 
            field={{
              ...CONFIG.FORM_FIELDS[0],
              options: userOptions,
              disabled: mode === 'edit'
            }} 
            register={register} 
            errors={errors} 
            setValue={setValue}
            watch={watch}
            trigger={trigger}
            formValues={formValues} 
          />
          <NumberField 
            field={CONFIG.FORM_FIELDS[1]} 
            register={register} 
            errors={errors} 
            setValue={setValue} 
            trigger={trigger} 
            formValues={formValues} 
          />
          <NumberField 
            field={CONFIG.FORM_FIELDS[2]} 
            register={register} 
            errors={errors} 
            setValue={setValue} 
            trigger={trigger} 
            formValues={formValues} 
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <DynamicButton type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </DynamicButton>
          <DynamicButton type="submit" variant="primary" loading={isSubmitting || saving} disabled={isSubmitting || saving}>
            {mode === 'create' ? 'Create Entry' : 'Update Entry'}
          </DynamicButton>
        </div>
      </form>
    </div>
  );
};

export default TeamDaysOffForm;

