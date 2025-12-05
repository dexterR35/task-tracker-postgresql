import React, { useMemo } from 'react';
import { useAppDataContext } from '@/context/AppDataContext';

/**
 * Consolidated Deliverables Hooks
 * Combines all deliverables-related functionality into a single file
 */

/**
 * Get all deliverables from the database and transform them into form options
 */
export const useDeliverablesOptions = () => {
  const { deliverables, isLoading, error } = useAppDataContext();

  // Transform database data to form options format - simplified without memoization
  const deliverablesOptions = !deliverables || deliverables.length === 0 ? [] : deliverables.map(deliverable => ({
    value: deliverable.name,
    label: deliverable.name,
    department: deliverable.department,
    timePerUnit: deliverable.timePerUnit,
    timeUnit: deliverable.timeUnit,
    requiresQuantity: deliverable.requiresQuantity,
    variationsTime: deliverable.variationsTime,
    variationsTimeUnit: deliverable.variationsTimeUnit || 'min'
  }));

  return {
    deliverablesOptions,
    isLoading,
    error
  };
};

/**
 * Context-independent version of useDeliverablesOptions
 * Accepts deliverables as props to avoid context dependency
 */
export const useDeliverablesOptionsFromProps = (deliverables = []) => {
  // Transform database data to form options format
  const deliverablesOptions = !deliverables || deliverables.length === 0 ? [] : deliverables.map(deliverable => ({
    value: deliverable.name,
    label: deliverable.name,
    department: deliverable.department,
    timePerUnit: deliverable.timePerUnit,
    timeUnit: deliverable.timeUnit,
    requiresQuantity: deliverable.requiresQuantity,
    variationsTime: deliverable.variationsTime,
    variationsTimeUnit: deliverable.variationsTimeUnit || 'min'
  }));

  return {
    deliverablesOptions,
    isLoading: false,
    error: null
  };
};

/**
 * Filter deliverables by selected department
 */
export const useDeliverablesByDepartment = (selectedDepartment) => {
  const { deliverablesOptions, isLoading, error } = useDeliverablesOptions();

  // Filter deliverables by selected department - simplified without memoization
  const filteredDeliverables = !selectedDepartment || !deliverablesOptions || deliverablesOptions.length === 0 ? [] : (() => {
    // Handle both array and string department formats
    const departmentToFilter = Array.isArray(selectedDepartment) 
      ? selectedDepartment[0] 
      : selectedDepartment;

    // Filter deliverables by selected department
    return deliverablesOptions.filter(deliverable => 
      deliverable.department === departmentToFilter
    );
  })();

  return {
    deliverablesOptions: filteredDeliverables,
    isLoading,
    error
  };
};

/**
 * Calculate time estimates for deliverables with variations support
 */
export const useDeliverableCalculation = (deliverablesUsed, deliverablesOptions) => {
  // Calculate deliverable time estimates - simplified without memoization
  if (!deliverablesUsed || !Array.isArray(deliverablesUsed) || deliverablesUsed.length === 0) {
    return {
      deliverablesList: [],
      totalTime: 0,
      totalMinutes: 0,
      totalDays: 0
    };
  }

  const deliverablesList = [];
  let totalTime = 0;

  deliverablesUsed.forEach((deliverable, index) => {
    const deliverableName = deliverable?.name;
    const quantity = deliverable?.count || 1;
    
    // Safety check for deliverableName
    if (!deliverableName || typeof deliverableName !== 'string') {
      return;
    }
    
    // Find deliverable in settings with case-insensitive matching
    const deliverableOption = deliverablesOptions ? deliverablesOptions.find(d => 
      d.value && d.value.toLowerCase().trim() === deliverableName.toLowerCase().trim()
    ) : null;
    
    if (deliverableOption) {
      // Calculate time for this deliverable
      const timePerUnit = deliverableOption.timePerUnit || 1;
      const timeUnit = deliverableOption.timeUnit || 'hr';
      const requiresQuantity = deliverableOption.requiresQuantity || false;
      
      // Only use variations if requiresQuantity is true
      const variationsTime = (requiresQuantity && deliverableOption.variationsTime) || 0;
      const variationsTimeUnit = deliverableOption.variationsTimeUnit || 'min';
      
  // Convert to minutes (base unit)
  let timeInMinutes = timePerUnit;
  if (timeUnit === 'hr') timeInMinutes = timePerUnit * 60;
      
      // Add variations time if present and requiresQuantity is true
      let variationsTimeInMinutes = 0;
      if (requiresQuantity && variationsTime > 0) {
        if (variationsTimeUnit === 'min') variationsTimeInMinutes = variationsTime;
        else if (variationsTimeUnit === 'hr') variationsTimeInMinutes = variationsTime * 60;
        else variationsTimeInMinutes = variationsTime; // Default to minutes
      }
      
      // Get variations quantity for this deliverable (if available in the data)
      // Only use variations if requiresQuantity is true
      const variationsQuantity = (requiresQuantity && (deliverable?.variationsCount || deliverable?.variationsQuantity || 0)) || 0;
      const totalvariationsTimeInMinutes = variationsQuantity * variationsTimeInMinutes;
      const calculatedTimeInMinutes = (timeInMinutes * quantity) + totalvariationsTimeInMinutes;
      
      // Convert to hours and days for display
      const calculatedTimeInHours = calculatedTimeInMinutes / 60;
      const calculatedTimeInDays = calculatedTimeInMinutes / 480; // 8 hours = 480 minutes
      totalTime += calculatedTimeInHours;
      
      deliverablesList.push({
        name: deliverableName,
        quantity: quantity,
        time: calculatedTimeInHours,
        timeInMinutes: calculatedTimeInMinutes,
        timeInDays: calculatedTimeInDays,
        timePerUnit: timePerUnit,
        timeUnit: timeUnit,
        variationsTime: variationsTime,
        variationsTimeUnit: variationsTimeUnit,
        variationsQuantity: variationsQuantity,
        timeInHours: calculatedTimeInHours,
        variationsTimeInMinutes: variationsTimeInMinutes,
        totalvariationsTimeInMinutes: totalvariationsTimeInMinutes,
        configured: true
      });
    } else {
      // If deliverable not found in settings, show warning
      deliverablesList.push({
        name: deliverableName,
        quantity: quantity,
        time: 0,
        timePerUnit: 0,
        timeUnit: 'hr',
        variationsTime: 0,
        variationsTimeUnit: 'min',
        timeInHours: 0,
        variationsTimeInHours: 0,
        notConfigured: true
      });
    }
  });

  return {
    deliverablesList,
    totalTime,
    totalMinutes: totalTime * 60
  };
};

/**
 * Calculate single deliverable time with variations
 */
export const calculateSingleDeliverable = (deliverableOption, quantity = 1, variationsQuantity = 0) => {
  if (!deliverableOption) {
    return {
      time: 0,
      timeInHours: 0,
      variationsTimeInHours: 0,
      totalTime: 0,
      minutes: 0,
      days: 0
    };
  }

  const timePerUnit = deliverableOption.timePerUnit || 1;
  const timeUnit = deliverableOption.timeUnit || 'hr';
  const requiresQuantity = deliverableOption.requiresQuantity || false;
  
  // Only use variations if requiresQuantity is true
  const variationsTime = (requiresQuantity && deliverableOption.variationsTime) || 0;
  const variationsTimeUnit = deliverableOption.variationsTimeUnit || 'min';
  
  // Convert to minutes (base unit)
  let timeInMinutes = timePerUnit;
  if (timeUnit === 'hr') timeInMinutes = timePerUnit * 60;
  
  // Add variations time if present and requiresQuantity is true
  let variationsTimeInMinutes = 0;
  if (requiresQuantity && variationsTime > 0) {
    if (variationsTimeUnit === 'min') variationsTimeInMinutes = variationsTime;
    else if (variationsTimeUnit === 'hr') variationsTimeInMinutes = variationsTime * 60;
    else variationsTimeInMinutes = variationsTime; // Default to minutes
  }
  
  // Only use variations quantity if requiresQuantity is true
  const effectiveVariationsQuantity = requiresQuantity ? variationsQuantity : 0;
  const totalvariationsTimeInMinutes = effectiveVariationsQuantity * variationsTimeInMinutes;
  const totalTimeInMinutes = (timeInMinutes * quantity) + totalvariationsTimeInMinutes;
  
  // Convert to hours and days for display
  const totalTimeInHours = totalTimeInMinutes / 60;
  const totalTimeInDays = totalTimeInMinutes / 480; // 8 hours = 480 minutes
  
  return {
    time: totalTimeInHours,
    timeInMinutes: totalTimeInMinutes,
    timeInDays: totalTimeInDays,
    timeInHours: totalTimeInHours,
    variationsTimeInMinutes: variationsTimeInMinutes,
    totalvariationsTimeInMinutes: totalvariationsTimeInMinutes,
    timePerUnit,
    timeUnit,
    variationsTime,
    variationsTimeUnit,
    variationsQuantity
  };
};

/**
 * Format deliverable display text
 */
export const formatDeliverableDisplay = (deliverable) => {
  if (!deliverable) return '';
  
  if (deliverable.notConfigured) {
    return '⚠️ Not configured in settings - Add to Settings → Deliverables';
  }
  
  // Calculate base time (without variations)
  const baseTime = deliverable.timeInHours * deliverable.quantity;
  
  if (deliverable.variationsTime > 0 && deliverable.variationsQuantity > 0) {
    const variationsQuantity = deliverable.variationsQuantity || 0;
    const variationsTimeInMinutes = deliverable.variationsTimeInMinutes || 0;
    
    return `${deliverable.timePerUnit}${deliverable.timeUnit} × ${deliverable.quantity} + ${variationsQuantity} × ${variationsTimeInMinutes.toFixed(0)}min = ${deliverable.time.toFixed(1)}h`;
  }
  
  return `${deliverable.timePerUnit}${deliverable.timeUnit} × ${deliverable.quantity} = ${baseTime.toFixed(1)}h`;
};

/**
 * Format variations display text
 */
export const formatvariationsDisplay = (variationsTime, variationsTimeUnit) => {
  if (!variationsTime || variationsTime <= 0) return '';
  
  const variationsMinutes = variationsTimeUnit === 'min' 
    ? variationsTime 
    : variationsTimeUnit === 'hr' 
      ? variationsTime * 60 
      : variationsTime * 8 * 60;
  
  return `+ ${variationsMinutes.toFixed(0)}min variations`;
};

/**
 * Format time breakdown for display
 */
export const formatTimeBreakdown = (totalTime) => {
  const totalMinutes = totalTime * 60;
  const totalDays = totalMinutes / 480; // 8 hours = 480 minutes
  
  return {
    hours: totalTime.toFixed(1),
    minutes: totalMinutes.toFixed(0),
    days: totalDays.toFixed(2),
    summary: `Total: ${totalTime.toFixed(1)}hr = ${totalMinutes.toFixed(0)}min = ${totalDays.toFixed(2)} days`
  };
};

// ===== FORMATTED DELIVERABLE CALCULATION COMPONENT =====
const FormattedDeliverableCalculation = ({ 
  deliverablesUsed, 
  showDetailedCalculations = false, 
  className = "" 
}) => {
  const { deliverablesOptions = [] } = useDeliverablesOptions();
  const { deliverablesList } = useDeliverableCalculation(deliverablesUsed, deliverablesOptions);
  
  if (!deliverablesList || deliverablesList.length === 0) {
    return <span className={`text-gray-500 dark:text-gray-400 ${className}`}>No deliverables</span>;
  }
  
  return (
    <div className={`space-y-1 ${className}`}>
      {deliverablesList.map((deliverable, index) => (
        <div key={index} className="text-sm">
          <div className="font-medium text-gray-900 dark:text-white">
            {deliverable.quantity}x{deliverable.name}
            {deliverable.variationsQuantity > 0 && (
              <span className="text-orange-600 dark:text-orange-400"> + {deliverable.variationsQuantity} variations</span>
            )}
          </div>
          
          {showDetailedCalculations && (
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {deliverable.configured ? (
                <div className="text-xs block">
                  <div className="block">
                    {deliverable.timePerUnit}{deliverable.timeUnit} × {deliverable.quantity}
                    {deliverable.variationsQuantity > 0 && deliverable.variationsTimeInMinutes > 0 && (
                      <span> + {deliverable.variationsQuantity} × {(deliverable.variationsTimeInMinutes || 0).toFixed(0)}min</span>
                    )}
                  </div>
                  <div className="block font-semibold text-yellow-600 dark:text-yellow-400">
                    Total: {deliverable.time}h ({(deliverable.time * 60 / 480).toFixed(2)} days)
                  </div>
                </div>
              ) : deliverable.notConfigured ? (
                <span className="text-amber-600 dark:text-amber-400">⚠️ Not configured in settings - Add to Settings → Deliverables</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">No time configuration</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ===== MAIN EXPORTS =====
export { FormattedDeliverableCalculation };
export { default as DeliverableTable } from './DeliverableTable';
export { default as DeliverableForm } from './DeliverableForm';
export { default as DeliverableFormModal } from './DeliverableFormModal';