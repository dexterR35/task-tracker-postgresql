import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '@/context/AuthContext';
import { Icons } from '@/components/icons';
import { CARD_SYSTEM } from '@/constants';

import { handleValidationError } from '@/features/utils/errorHandling';
import { prepareFormData, createFormSubmissionHandler, handleFormValidation } from '@/utils/formUtils';
import { loginSchema, LOGIN_FORM_FIELDS } from '@/components/forms/configs/useLoginForm';
import TextField from '@/components/forms/components/TextField';
import PasswordField from '@/components/forms/components/PasswordField';
import DynamicButton from '@/components/ui/Button/DynamicButton';

const LoginIcon = Icons.buttons.login;



const LoginForm = ({ onSuccess, className = "" }) => {
  const { login } = useAuth();
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  // Create standardized form submission handler
  const handleFormSubmit = createFormSubmissionHandler(
    async (data) => {
      // Prepare login data with lowercase enforcement for email
      const preparedData = prepareFormData(data, {
        fieldsToLowercase: ['email'],
        fieldsToKeepUppercase: [] // No uppercase exceptions for login
      });
      
      return await login(preparedData);
    },
    {
      operation: 'login',
      resource: 'user',
      onSuccess: (result) => {
        // Don't show success toast here - AuthContext already shows welcome toast
        onSuccess?.(result);
      },
      showSuccessToast: false, // Success toast is handled in AuthContext (welcome message)
      showErrorToast: false // Error toast is handled in AuthContext (showAuthError)
    }
  );

  const onSubmit = async (data) => {
    try {
      await handleFormSubmit(data, { reset, setError: () => {}, clearErrors: () => {} });
    } catch (error) {
      // Error is already handled by AuthContext (shows toast)
      // Just catch it here to prevent unhandled promise rejection
      // No need to do anything else as AuthContext handles the error display
    }
  };

  const handleFormError = (errors) => {
    handleFormValidation(errors, 'Login Form');
  };

  // Use blue color for login (professional, trust, primary)
  const cardColorHex = useMemo(
    () => CARD_SYSTEM.COLOR_HEX_MAP.blue || "#467dfd",
    []
  );

  return (
    <div className={`${className} relative bg-white dark:bg-smallCard border border-gray-200 dark:border-gray-700 shadow-xl rounded-2xl overflow-hidden w-full max-w-md`}>
      {/* Accent border on top - clean solid color */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{
          backgroundColor: cardColorHex,
        }}
      />

      <div className="flex flex-col p-8 relative z-10">
        {/* Modern Header Section */}
        <div className="flex items-center gap-4 mb-8">
          {/* Clean Icon with solid background */}
       

          {/* Title & Subtitle */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-0">
              Welcome
            </h2>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Sign in to your account
            </p>
          </div>
        </div>

        {/* Form Section - Clean modern design */}
        <form onSubmit={handleSubmit(onSubmit, handleFormError)} className="space-y-5">
          <div className="space-y-2">
            <TextField
              field={LOGIN_FORM_FIELDS[0]}
              register={register}
              errors={errors}
            />
          </div>

          <div className="space-y-2">
            <PasswordField
              field={LOGIN_FORM_FIELDS[1]}
              register={register}
              errors={errors}
            />
          </div>

          <div className="pt-2">
            <DynamicButton
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              loading={isSubmitting}
              iconName="login"
              iconPosition="left"
              loadingText="Logging in..."
              className="w-full h-12 font-semibold "
           
            >
              UNLOCk
            </DynamicButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;

