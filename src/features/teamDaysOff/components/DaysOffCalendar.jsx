import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Icons } from '@/components/icons';
import { useTeamDaysOff } from '../teamDaysOffApi';
import { useAuth } from '@/context/AuthContext';
import SearchableSelectField from '@/components/forms/components/SearchableSelectField';
import DynamicButton from '@/components/ui/Button/DynamicButton';
import Tooltip from '@/components/ui/Tooltip/Tooltip';
import { showSuccess, showError } from '@/utils/toast';
import { logger } from '@/utils/logger';
import { formatDateString } from '@/utils/dateUtils';
import TeamDaysOffFormModal from './TeamDaysOffFormModal';
import Modal from '@/components/ui/Modal/Modal';
import DynamicCalendar, { getUserColor, generateMultiColorGradient, useCalendarUsers, filterUsersByRole, ColorLegend } from '@/components/Calendar/DynamicCalendar';
import { RESEND_CONFIG } from '@/constants';

/**
 * Calendar component to display and manage days off for users
 * Supports admin and regular user flows
 */
const DaysOffCalendar = ({ teamDaysOff: propTeamDaysOff = [] }) => {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === 'admin';
  // Use real-time data from hook - prop is redundant since hook provides real-time updates
  const { teamDaysOff: realTimeTeamDaysOff = [], addOffDays, removeOffDays } = useTeamDaysOff();
  // Always use real-time data from hook (prop is legacy/fallback, but hook should always have data)
  // Use realTimeTeamDaysOff directly to ensure real-time updates are reflected immediately
  const teamDaysOff = realTimeTeamDaysOff.length > 0 ? realTimeTeamDaysOff : propTeamDaysOff;
  
  // Debug: Log when teamDaysOff changes
  useEffect(() => {
    logger.log('📅 [DaysOffCalendar] teamDaysOff updated:', teamDaysOff.length, 'entries');
  }, [teamDaysOff]);
  
  // Use shared hook for user fetching
  const allUsers = useCalendarUsers();

  // Admin starts with no user selected (can select any user)
  // Regular users automatically have themselves selected
  const [selectedUserId, setSelectedUserId] = useState(isAdmin ? '' : (authUser?.userUID || ''));
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // For regular users, ensure they always have themselves selected
  useEffect(() => {
    if (!isAdmin && authUser?.userUID && !selectedUserId) {
      setSelectedUserId(authUser.userUID);
    }
  }, [isAdmin, authUser, selectedUserId]);
  
  // State for date selection
  const [selectedDates, setSelectedDates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [recentlySavedDates, setRecentlySavedDates] = useState([]); // Track recently saved dates for email
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Get selected user
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return allUsers.find(u => (u.userUID || u.id) === selectedUserId);
  }, [selectedUserId, allUsers]);

  // Get user's color from database color_set field
  const userColor = useMemo(() => {
    if (!selectedUser) return '#64748B'; // gray
    return getUserColor(selectedUser);
  }, [selectedUser]);

  // Get selected user's team days off entry
  const selectedUserEntry = useMemo(() => {
    if (!selectedUserId) return null;
    return teamDaysOff.find(e => (e.userUID || e.userId) === selectedUserId);
  }, [teamDaysOff, selectedUserId]);

  // Get selected user's off days
  // Create a new array reference to ensure reactivity when offDays changes
  const selectedUserOffDays = useMemo(() => {
    if (!selectedUserEntry?.offDays) return [];
    // Create a new array reference to ensure React detects changes
    return Array.isArray(selectedUserEntry.offDays) ? [...selectedUserEntry.offDays] : [];
  }, [selectedUserEntry?.offDays, selectedUserEntry?.id]);

  // Check if selected user has available days (baseDays > 0 or daysTotal > 0)
  const hasAvailableDays = useMemo(() => {
    if (!selectedUserEntry) return false;
    const baseDays = selectedUserEntry.baseDays || 0;
    const daysTotal = selectedUserEntry.daysTotal || 0;
    return baseDays > 0 || daysTotal > 0;
  }, [selectedUserEntry]);

  // Check if a date is a weekend (Saturday = 6, Sunday = 0)
  const isWeekend = useCallback((date) => {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  }, []);

  // Check if a date is in the past
  const isPastDate = useCallback((date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    return dateToCheck < today;
  }, []);

  // Check if a date is disabled (weekend or past)
  const isDateDisabled = useCallback((date) => {
    return isWeekend(date) || isPastDate(date);
  }, [isWeekend, isPastDate]);

  // Create lookup map for date -> users
  // Create a stable key to track changes - use JSON.stringify for reliable change detection
  const teamDaysOffKey = useMemo(() => {
    return JSON.stringify(teamDaysOff.map(e => ({
      id: e.id,
      userUID: e.userUID || e.userId,
      offDaysLength: (e.offDays || []).length,
      offDays: (e.offDays || []).map(d => 
        typeof d === 'string' ? d : (d?.dateString || `${d?.year}-${d?.month}-${d?.day}` || '')
      )
    })));
  }, [teamDaysOff]);
  
  const dateToUsersMap = useMemo(() => {
    // Always create a new Map instance to ensure React detects the change
    const map = new Map();
    teamDaysOff.forEach(entry => {
      const userUID = entry.userUID || entry.userId;
      if (!userUID) return;
      
      const user = allUsers.find(u => (u.userUID || u.id) === userUID);
      if (!user) return;
      
      const offDays = Array.isArray(entry.offDays) ? entry.offDays : [];
      offDays.forEach(offDay => {
        let dateString;
        if (typeof offDay === 'string') {
          dateString = offDay;
        } else if (offDay && typeof offDay === 'object') {
          if (offDay.dateString) {
            dateString = offDay.dateString;
          } else if (offDay.year && offDay.month && offDay.day) {
            const month = String(offDay.month).padStart(2, '0');
            const day = String(offDay.day).padStart(2, '0');
            dateString = `${offDay.year}-${month}-${day}`;
          } else {
            dateString = formatDateString(offDay);
          }
        } else {
          dateString = formatDateString(offDay);
        }
        
        if (!dateString) return;
        
        if (!map.has(dateString)) {
          map.set(dateString, []);
        }
        map.get(dateString).push({
          userUID,
          userName: user.name || user.email || 'Unknown',
          color: getUserColor(user)
        });
      });
    });
    // Log map size for debugging
    logger.log('📅 [DaysOffCalendar] dateToUsersMap updated:', map.size, 'dates');
    return map;
  }, [teamDaysOffKey, teamDaysOff, allUsers]);


  // Get day data for a specific date
  // Include teamDaysOffKey in dependencies to force recalculation when data changes
  const getDayData = useCallback((date) => {
    const dateString = formatDateString(date);
    const usersOff = dateToUsersMap.get(dateString) || [];
    const isOff = selectedUserId ? usersOff.some(u => u.userUID === selectedUserId) : false;
    const isSelected = selectedUserId ? selectedDates.some(d => formatDateString(d) === dateString) : false;
    const isDisabled = isDateDisabled(date);
    
    return {
      isOff,
      isSelected,
      usersOff,
      isDisabled,
      canSelect: selectedUserId && hasAvailableDays && !isOff && !isDisabled
    };
  }, [selectedUserId, hasAvailableDays, dateToUsersMap, selectedDates, isDateDisabled, teamDaysOffKey]);

  // Get all users with their assigned colors for legend
  // Admin sees all users, regular users see only themselves
  // Colors are from database color_set field
  const allUsersWithColors = useMemo(() => {
    const usersWithData = allUsers.map(user => {
      const userUID = user.userUID || user.id;
      const userName = user.name || user.email || 'Unknown';
      
      // Get color from database color_set field
      const color = getUserColor(user);
      
      // Find off days for this user
      const entry = teamDaysOff.find(e => (e.userUID || e.userId) === userUID);
      // Ensure offDays is always an array and create a new reference for reactivity
      const offDays = Array.isArray(entry?.offDays) ? [...entry.offDays] : [];
      
      return {
        userUID,
        userName,
        color,
        offDays
      };
    });
    
    // Use shared utility for filtering users by role
    return filterUsersByRole(usersWithData, {
      isAdmin,
      authUserUID: authUser?.userUID,
      selectedUserId
    });
  }, [allUsers, teamDaysOff, isAdmin, authUser, selectedUserId]);

  // Handle date click
  const handleDateClick = useCallback((date) => {
    if (!selectedUserId) {
      showError('Please select a user first');
      return;
    }

    // Check if user has available days
    if (!hasAvailableDays) {
      showError('User has no available days off. Please add base days first.');
      return;
    }

    // Check if date is disabled (weekend or past)
    if (isDateDisabled(date)) {
      if (isWeekend(date)) {
        showError('Weekends cannot be selected');
      } else {
        showError('Past dates cannot be selected');
      }
      return;
    }

    const dateString = formatDateString(date);
    const usersOff = dateToUsersMap.get(dateString) || [];
    const isOff = usersOff.some(u => u.userUID === selectedUserId);
    
    // Check if date is already saved
    if (isOff) {
      return;
    }

    // Toggle selection
    setSelectedDates(prev => {
      const exists = prev.some(d => formatDateString(d) === dateString);
      if (exists) {
        return prev.filter(d => formatDateString(d) !== dateString);
      } else {
        return [...prev, date];
      }
    });
  }, [selectedUserId, dateToUsersMap, isDateDisabled, isWeekend]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!selectedUserId || selectedDates.length === 0) {
      showError('Please select a user and at least one date');
      return;
    }

    setSaving(true);
    try {
      await addOffDays(selectedUserId, selectedDates, authUser);
      showSuccess(`Successfully saved ${selectedDates.length} day(s) off`);
      // Store recently saved dates for email functionality
      setRecentlySavedDates([...selectedDates]);
      setSelectedDates([]); // Clear selections after save
    } catch (error) {
      logger.error('Error saving off days:', error);
      showError(error.message || 'Failed to save off days');
    } finally {
      setSaving(false);
    }
  }, [selectedUserId, selectedDates, addOffDays, authUser]);

  // Handle remove
  const handleRemove = useCallback(async (date) => {
    if (!selectedUserId) return;

    setSaving(true);
    try {
      await removeOffDays(selectedUserId, [date], authUser);
      showSuccess('Day off removed successfully');
      // Real-time listener will update automatically - no delay needed
    } catch (error) {
      logger.error('Error removing off day:', error);
      showError(error.message || 'Failed to remove off day');
    } finally {
      setSaving(false);
    }
  }, [selectedUserId, removeOffDays, authUser]);

  // Handle send email to HR - Opens email modal
  const handleSendEmail = useCallback(() => {
    if (!selectedUserId || recentlySavedDates.length === 0) {
      showError('No saved dates to send email for');
      return;
    }
    // Open email modal
    setShowEmailModal(true);
  }, [selectedUserId, recentlySavedDates]);

  // Handle email modal close - clear recently saved dates
  const handleEmailModalClose = useCallback(() => {
    setShowEmailModal(false);
    // Clear recently saved dates after email is sent or modal is closed
    setRecentlySavedDates([]);
  }, []);

  // Format dates for email display
  const formattedEmailDates = useMemo(() => {
    if (!recentlySavedDates || recentlySavedDates.length === 0) return [];
    return recentlySavedDates.map(date => {
      const dateObj = date instanceof Date ? date : new Date(date);
      return {
        dateString: format(dateObj, 'yyyy-MM-dd'),
        displayString: format(dateObj, 'MMMM dd, yyyy'),
        dateObj
      };
    });
  }, [recentlySavedDates]);

  // Determine which user to use for email (selected user or auth user)
  const emailUser = useMemo(() => {
    return selectedUser || authUser;
  }, [selectedUser, authUser]);

  // Get user email for email modal
  const userEmail = useMemo(() => {
    return emailUser?.email || '';
  }, [emailUser?.email]);

  // Get user name for email modal
  const userName = useMemo(() => {
    return emailUser?.name || emailUser?.email || 'User';
  }, [emailUser?.name, emailUser?.email]);

  // Create email template content
  const emailTemplate = useMemo(() => {
    const datesList = formattedEmailDates.map(d => d.displayString).join('\n');
    const totalDays = formattedEmailDates.length;
    
    return `Hello HR Team,

I would like to request the following days off:

Employee: ${userName}
Email: ${userEmail}
Total Days: ${totalDays}

Requested Dates:
${datesList}

Thank you for your consideration.

Best regards,
${userName}`;
  }, [formattedEmailDates, userName, userEmail]);

  // Handle send email
  const handleSendEmailNow = useCallback(async () => {
    if (!userEmail) {
      showError('User email is required to send email');
      return;
    }

    if (formattedEmailDates.length === 0) {
      showError('No dates selected to send email for');
      return;
    }

    // Check if HR email is configured
    if (!RESEND_CONFIG.HR_EMAIL || RESEND_CONFIG.HR_EMAIL === 'hr@company.com') {
      showError('HR email is not configured. Please contact administrator.');
      logger.error('Resend configuration missing: HR email not set');
      return;
    }

    setSendingEmail(true);

    try {
      // Prepare email data for Resend API
      const emailData = {
        to_email: RESEND_CONFIG.HR_EMAIL,
        from_email: userEmail,
        from_name: userName,
        subject: `Days Off Request - ${userName}`,
        message: emailTemplate,
        dates: formattedEmailDates.map(d => d.displayString).join(', '),
        total_days: formattedEmailDates.length.toString(),
        employee_name: userName,
        employee_email: userEmail
      };

      // Send email using Resend API endpoint
      const response = await fetch(RESEND_CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      logger.log('Email sent successfully to HR');
      showSuccess('Email sent successfully to HR!');
      
      // Close modal after successful send
      setTimeout(() => {
        handleEmailModalClose();
      }, 1000);
    } catch (error) {
      logger.error('Error sending email:', error);
      showError(error.message || 'Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  }, [userEmail, formattedEmailDates, emailTemplate, userName, handleEmailModalClose]);

  // Handle user selection change
  const handleUserSelect = useCallback((userId) => {
    if (!isAdmin && userId !== authUser?.userUID) {
      return; // Regular users can only select themselves
    }
    setSelectedUserId(userId || '');
    setSelectedDates([]); // Clear selections when user changes
    setRecentlySavedDates([]); // Clear recently saved dates
  }, [isAdmin, authUser]);

  // Handle entry modal success
  const handleEntrySuccess = useCallback(() => {
    setShowEntryModal(false);
    // Data will be updated automatically via real-time hook
  }, []);

  // Handle year change from calendar (memoized to prevent re-renders)
  const handleYearChange = useCallback((year) => {
    // Only update if year actually changed to prevent loops
    setCurrentYear(prev => prev !== year ? year : prev);
  }, []);

  // Prepare user options for select
  const userOptions = useMemo(() => {
    if (!isAdmin) {
      // Regular users only see themselves
      return [{
        value: authUser?.userUID || '',
        label: authUser?.name || authUser?.email || 'You'
      }];
    }
    return allUsers.map(user => ({
      value: user.userUID || user.id,
      label: user.name || user.email
    }));
  }, [isAdmin, allUsers, authUser]);

  // Memoize user color and selected user name to avoid recalculation
  const selectedUserName = useMemo(() => selectedUser?.name || 'User', [selectedUser?.name]);
  const selectedUserColor = useMemo(() => {
    if (!selectedUser) return '#64748B';
    const colorSet = selectedUser.color_set || selectedUser.colorSet;
    return colorSet ? (colorSet.startsWith('#') ? colorSet : `#${colorSet}`) : '#64748B';
  }, [selectedUser?.color_set, selectedUser?.colorSet]);
  
  // Render day cell
  const renderDay = useCallback((day, dayIndex, dayData) => {
    if (!dayData) {
      dayData = getDayData(day.date);
    }

    const { isOff, isSelected, usersOff, isDisabled, canSelect } = dayData;
    
    // Filter users based on admin/selected user
    let visibleUsersOff = usersOff;
    if (isAdmin) {
      if (selectedUserId) {
        visibleUsersOff = usersOff.filter(u => u.userUID === selectedUserId);
      }
    } else {
      visibleUsersOff = usersOff.filter(u => u.userUID === authUser?.userUID);
    }
    
    const hasUsersOff = visibleUsersOff.length > 0;
    
    // Determine styles
    let bgColor = 'bg-gray-50 dark:bg-gray-600';
    let textColor = 'text-gray-600 dark:text-gray-200';
    const style = {};
    
    if (isDisabled && !hasUsersOff) {
      bgColor = 'bg-gray-100 dark:bg-gray-700';
      textColor = 'text-gray-400 dark:text-gray-600';
      style.opacity = 0.4;
    } else if (isSelected) {
      bgColor = '';
      textColor = 'text-white font-semibold';
      style.backgroundColor = userColor;
    } else if (isOff && selectedUserId) {
      bgColor = '';
      textColor = 'text-white font-semibold';
      style.backgroundColor = userColor;
    } else if (hasUsersOff) {
      bgColor = '';
      textColor = 'text-white font-semibold';
      if (visibleUsersOff.length > 1) {
        style.background = generateMultiColorGradient(visibleUsersOff);
      } else {
        style.backgroundColor = visibleUsersOff[0].color;
      }
      style.opacity = isDisabled ? 0.6 : 1;
    }

    // Tooltip content
    let tooltipContent = '';
    let tooltipUsers = [];
    
    if (isOff && selectedUserId) {
      tooltipContent = `${selectedUserName} - Off${isDisabled ? ' (Past date)' : ''}`;
      tooltipUsers = [{ userName: selectedUserName, color: selectedUserColor }];
    } else if (hasUsersOff) {
      tooltipContent = `${visibleUsersOff.length > 1 ? `${visibleUsersOff.length} users off` : 'User off'}${isDisabled ? ' (Past date)' : ''}`;
      tooltipUsers = visibleUsersOff.map(u => ({
        userUID: u.userUID,
        userName: u.userName,
        color: u.color
      }));
    } else if (isDisabled) {
      tooltipContent = isWeekend(day.date) ? 'Weekend - Cannot be selected' : 'Past date - Cannot be selected';
    } else if (canSelect) {
      tooltipContent = 'Click to select';
    } else if (!hasAvailableDays && selectedUserId) {
      tooltipContent = 'User has no available days off. Add base days first.';
    } else if (!selectedUserId) {
      tooltipContent = isAdmin ? 'Select a user to manage their days off, or view all users\' days off' : 'Your days off';
    }

    return (
      <Tooltip
        key={`${dayIndex}-${formatDateString(day.date)}`}
        content={tooltipContent}
        users={tooltipUsers}
      >
        <div
          className={`rounded text-sm flex flex-col items-center justify-center relative ${bgColor} ${textColor} ${canSelect ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors' : 'cursor-not-allowed'}`}
          style={{ ...style, aspectRatio: '1 / 1' }}
          onClick={() => canSelect && handleDateClick(day.date)}
        >
          <span>{day.date.getDate()}</span>
          {isOff && selectedUserId && (
            <DynamicButton
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(day.date);
              }}
              className="absolute top-0 right-0 text-[10px] w-3 h-4 min-w-[10px] p-0 flex items-center justify-center bg-red-500/80 hover:bg-red-600 text-white rounded-bl rounded-tr"
              title="Remove"
            >
              ×
            </DynamicButton>
          )}
        </div>
      </Tooltip>
    );
  }, [selectedUserId, isAdmin, authUser, userColor, selectedUserName, selectedUserColor, hasAvailableDays, getDayData, isWeekend, handleDateClick, handleRemove]);

  return (
    <div className="days-off-calendar space-y-6">
      {/* User Selection - Above calendar */}
      {isAdmin && (
        <div className="w-full max-w-md">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select User
          </label>
          <SearchableSelectField
            field={{
              name: "selectedUser",
              type: "select",
              label: "",
              required: false,
              options: userOptions,
              placeholder: "Search users...",
            }}
            register={() => {}}
            errors={{}}
            setValue={(fieldName, value) => {
              if (fieldName === "selectedUser") {
                handleUserSelect(value);
              }
            }}
            watch={() => selectedUserId || ""}
            trigger={() => {}}
            clearErrors={() => {}}
            formValues={{}}
            noOptionsMessage="No users found"
          />
        </div>
      )}

      {/* Color Legend - Above calendar */}
      <ColorLegend
        users={allUsersWithColors}
        selectedUserId={selectedUserId}
        countLabel="days"
        getCount={(user) => user.offDays?.length || 0}
      />

      {/* Warning message if user has no available days */}
      {selectedUserId && !hasAvailableDays && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Icons.generic.warning className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                No Available Days Off
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This user has no base days configured. Please add base days in the table above before selecting days off in the calendar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons - Above calendar */}
      {selectedUserId && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Entry button - only visible to admins */}
          {isAdmin && (
            <DynamicButton
              variant="secondary"
              size="md"
              onClick={() => setShowEntryModal(true)}
              icon={Icons.buttons.edit}
            >
              Entry
            </DynamicButton>
          )}
          
          <DynamicButton
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={!hasAvailableDays || selectedDates.length === 0 || saving || selectedDates.some(date => {
              const dateString = formatDateString(date);
              const usersOff = dateToUsersMap.get(dateString) || [];
              return usersOff.some(u => u.userUID === selectedUserId);
            })}
            loading={saving}
            icon={Icons.buttons.save}
          >
            Save ({selectedDates.length})
          </DynamicButton>
          
          {recentlySavedDates.length > 0 && (
            <DynamicButton
              variant="secondary"
              size="md"
              onClick={handleSendEmail}
            >
              Send Email to HR ({recentlySavedDates.length} saved days)
            </DynamicButton>
          )}
        </div>
      )}

      {/* Dynamic Calendar - Show all months */}
      <DynamicCalendar
        key={`calendar-${currentYear}-${selectedUserId || 'none'}-${teamDaysOffKey.substring(0, 100)}`}
        initialMonth={new Date(currentYear, 0, 1)}
        getDayData={getDayData}
        renderDay={renderDay}
        onMonthChange={handleYearChange}
        config={{
          title: 'Days Off Calendar',
          description: isAdmin ? 'Select a user and manage their days off' : 'Manage your days off',
          showNavigation: true,
          showMultipleMonths: true,
          emptyMessage: 'No days off data',
          emptyCheck: null,
          className: 'card p-6 space-y-6'
        }}
        headerActions={
          <div className="flex items-center gap-2">
            <DynamicButton
              variant="secondary"
              size="md"
              onClick={() => setCurrentYear(prev => prev - 1)}
              icon={Icons.buttons.chevronLeft}
            />
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300 min-w-[100px] text-center">
              {currentYear}
            </span>
            <DynamicButton
              variant="secondary"
              size="md"
              onClick={() => setCurrentYear(prev => prev + 1)}
              icon={Icons.buttons.chevronRight}
            />
          </div>
        }
      />

      {/* Entry Modal - only visible to admins */}
      {isAdmin && showEntryModal && (
        <TeamDaysOffFormModal
          isOpen={showEntryModal}
          onClose={() => setShowEntryModal(false)}
          mode={selectedUserEntry ? "edit" : "create"}
          teamDaysOff={selectedUserEntry || null}
          initialUserId={selectedUserId || null}
          onSuccess={handleEntrySuccess}
        />
      )}

      {/* Email Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={handleEmailModalClose}
        title="Send Email to HR"
        maxWidth="max-w-4xl"
        bgColor="primary"
        showClose={true}
      >
        <div className="p-5 space-y-4">
          {/* Employee Information Section */}
          <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Employee Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Employee Email
                </label>
                <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/60 dark:border-gray-700/50">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {userEmail || 'No email available'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Employee Name
                </label>
                <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/60 dark:border-gray-700/50">
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {userName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Days Off Section */}
          <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              Days Off ({formattedEmailDates.length} day{formattedEmailDates.length !== 1 ? 's' : ''})
            </h3>
            <div className="px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/60 dark:border-gray-700/50 max-h-48 overflow-y-auto">
              <div className="space-y-1">
                {formattedEmailDates.map((date, index) => (
                  <div key={index} className="text-sm text-gray-900 dark:text-gray-100">
                    {date.displayString}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Email Template Preview Section */}
          <div className="bg-gray-50/80 dark:bg-gray-dark/30 rounded-lg p-4 border border-gray-200/60 dark:border-gray-700/50">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Email Template</h3>
            <div className="px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/60 dark:border-gray-700/50">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                {emailTemplate}
              </pre>
            </div>
          </div>

          {/* Thanks Message */}
          <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/50 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Thank you for submitting your days off request. HR will review and respond to your request shortly.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200/60 dark:border-gray-700/50">
            <DynamicButton
              variant="secondary"
              size="md"
              onClick={handleEmailModalClose}
              disabled={sendingEmail}
            >
              Close
            </DynamicButton>
            <DynamicButton
              variant="primary"
              size="md"
              onClick={handleSendEmailNow}
              loading={sendingEmail}
              disabled={!userEmail || formattedEmailDates.length === 0 || sendingEmail}
              icon={Icons.generic.message}
            >
              Send Now
            </DynamicButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DaysOffCalendar;
