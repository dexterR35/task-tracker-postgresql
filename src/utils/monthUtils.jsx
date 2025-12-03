import React, { useState } from "react";
import {
  format,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
  isValid,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  addWeeks,
  addDays,
} from "date-fns";
import { parseMonthId, getCurrentMonthId } from "@/utils/dateUtils";
import { Icons } from "@/components/icons";
import { useAppDataContext } from "@/context/AppDataContext";
import ChartHeader from "@/components/Cards/ChartHeader";
import { CARD_SYSTEM } from "@/constants";
import { useCreateMonthBoard } from "@/features/months/monthsApi";
import { showSuccess, showError } from "@/utils/toast";
import { logger } from "@/utils/logger";
import DynamicButton from "@/components/ui/Button/DynamicButton";
import { canCreateBoard } from "@/features/utils/authUtils";

export const getWeeksInMonth = (monthId) => {
  const date = typeof monthId === "string" ? parseMonthId(monthId) : monthId;
  if (!isValid(date)) {
    logger.error("Invalid date provided to getWeeksInMonth");
    return [];
  }

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  const weeks = [];
  // Find the first Monday within the month
  let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday of the week containing month start

  // If the Monday is before the month starts, find the first Monday of the month
  if (currentWeekStart < monthStart) {
    const dayOfWeek = monthStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (dayOfWeek === 1) {
      // Month starts on Monday
      currentWeekStart = monthStart;
    } else {
      // Calculate days to add to get to the first Monday
      // If dayOfWeek is 0 (Sunday), add 1 day. Otherwise add (8 - dayOfWeek) days
      const daysToAdd = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      currentWeekStart = addDays(monthStart, daysToAdd);
    }
  }

  let weekNumber = 1;

  while (currentWeekStart <= monthEnd) {
    // Calculate Friday of the week (Monday + 4 days = Friday)
    const weekEndFriday = addDays(currentWeekStart, 4);

    // Get week days (Monday-Friday only)
    const weekDays = eachDayOfInterval({
      start: currentWeekStart,
      end: weekEndFriday,
    }).filter((day) => !isWeekend(day) && day >= monthStart && day <= monthEnd);

    if (weekDays.length > 0) {
      // Use Friday as endDate, but only if it's within the month
      const actualWeekEnd =
        weekEndFriday <= monthEnd
          ? weekEndFriday
          : weekDays[weekDays.length - 1];

      weeks.push({
        weekNumber,
        startDate: currentWeekStart,
        endDate: actualWeekEnd,
        days: weekDays,
        startDateStr: format(currentWeekStart, "yyyy-MM-dd"),
        endDateStr: format(actualWeekEnd, "yyyy-MM-dd"),
        label: `Week ${weekNumber} (${format(currentWeekStart, "MMM dd")} - ${format(actualWeekEnd, "MMM dd")})`,
      });
    }

    currentWeekStart = addWeeks(currentWeekStart, 1);
    weekNumber++;
  }

  return weeks;
};

export const getTasksForWeek = (tasks, week) => {
  if (!tasks || !Array.isArray(tasks) || !week) {
    return {};
  }

  const weekTasks = {};

  // Initialize each day with empty array
  week.days.forEach((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    weekTasks[dayStr] = [];
  });

  // Filter and group tasks by day
  tasks.forEach((task) => {
    if (!task.data_task?.startDate) return;

    const taskStartDate = new Date(task.data_task.startDate);
    const taskEndDate = task.data_task.endDate
      ? new Date(task.data_task.endDate)
      : taskStartDate;

    // Check if task falls within this week
    if (taskStartDate >= week.startDate && taskStartDate <= week.endDate) {
      const dayStr = format(taskStartDate, "yyyy-MM-dd");
      if (weekTasks[dayStr]) {
        weekTasks[dayStr].push(task);
      }
    }
  });

  return weekTasks;
};

export const getCurrentWeekNumber = (monthId) => {
  const date = typeof monthId === "string" ? parseMonthId(monthId) : monthId;
  if (!isValid(date)) return 1;

  const today = new Date();
  const monthStart = startOfMonth(date);

  // If today is not in this month, return first week
  if (today < monthStart || today > endOfMonth(date)) {
    return 1;
  }

  const weeks = getWeeksInMonth(monthId);
  const currentWeek = weeks.find(
    (week) => today >= week.startDate && today <= week.endDate
  );

  return currentWeek ? currentWeek.weekNumber : 1;
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

const validateMonthId = (monthId) => {
  if (!monthId || typeof monthId !== "string") {
    return { isValid: false, error: "Month ID must be a non-empty string" };
  }

  const monthIdRegex = /^\d{4}-\d{2}$/;
  if (!monthIdRegex.test(monthId)) {
    return { isValid: false, error: "Month ID must be in format YYYY-MM" };
  }

  const [year, month] = monthId.split("-");
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  if (yearNum < 1900 || yearNum > 2100) {
    return { isValid: false, error: "Year must be between 1900 and 2100" };
  }

  if (monthNum < 1 || monthNum > 12) {
    return { isValid: false, error: "Month must be between 01 and 12" };
  }

  return { isValid: true, error: null };
};

const createLocalDate = (year, month, day) => {
  // Create date in local timezone to avoid timezone shifts
  return new Date(year, month - 1, day);
};

// ============================================================================
// MONTH UTILITY FUNCTIONS
// ============================================================================

export const getCurrentMonthInfo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() returns 0-11, we want 1-12

  // Use date-fns for consistent date handling
  const startDate = startOfMonth(now);
  const endDate = endOfMonth(now);

  return {
    monthId: `${year}-${String(month).padStart(2, "0")}`,
    monthName: now.toLocaleString("default", { month: "long" }),
    year: year,
    month: month,
    startDate: startDate,
    endDate: endDate,
    daysInMonth: getDaysInMonth(now),
  };
};

export const getMonthBoundaries = (monthId) => {
  // Validate input
  const validation = validateMonthId(monthId);
  if (!validation.isValid) {
    logger.error("Invalid monthId in getMonthBoundaries:", validation.error);
    throw new Error(validation.error);
  }

  const [year, month] = monthId.split("-");
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  try {
    // Use date-fns for consistent date handling with proper timezone
    const firstDay = createLocalDate(yearNum, monthNum, 1);
    const lastDay = endOfMonth(firstDay);

    return {
      min: format(firstDay, "yyyy-MM-dd"),
      max: format(lastDay, "yyyy-MM-dd"),
    };
  } catch (error) {
    logger.error("Error in getMonthBoundaries:", error);
    throw new Error(`Failed to get month boundaries: ${error.message}`);
  }
};

export const getMonthDateRange = (monthId) => {
  // Validate input
  const validation = validateMonthId(monthId);
  if (!validation.isValid) {
    logger.error("Invalid monthId in getMonthDateRange:", validation.error);
    throw new Error(validation.error);
  }

  const [year, month] = monthId.split("-");
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  // Use date-fns for consistent date handling
  const firstDay = createLocalDate(yearNum, monthNum, 1);
  const lastDay = endOfMonth(firstDay);

  // Return ISO strings for API compatibility, but ensure they represent the correct dates
  return {
    startDate: firstDay.toISOString(),
    endDate: lastDay.toISOString(),
  };
};

export const getMonthInfo = (date = new Date()) => {
  // Validate input date
  if (!isValid(date)) {
    logger.error("Invalid date provided to getMonthInfo");
    throw new Error("Invalid date provided");
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const monthId = `${year}-${String(month).padStart(2, "0")}`;
  const yearId = year.toString();

  // Use date-fns for consistent date handling
  const startDate = startOfMonth(date);
  const endDate = endOfMonth(date);

  return {
    monthId,
    yearId,
    year: year, // Add year field for month board creation
    month: month, // Add month field for month board creation
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    monthName: date.toLocaleString("default", { month: "long" }),
    daysInMonth: getDaysInMonth(date),
  };
};

export const calculateMonthProgress = (monthId, daysInMonth = 30) => {
  if (!monthId) {
    return { progress: 0, daysPassed: 0, totalDays: 0, daysRemaining: 0 };
  }

  const validation = validateMonthId(monthId);
  if (!validation.isValid) {
    logger.error(
      "Invalid monthId in calculateMonthProgress:",
      validation.error
    );
    return { progress: 0, daysPassed: 0, totalDays: 0, daysRemaining: 0 };
  }

  let totalDays;
  try {
    const monthIdParts = monthId.split("-");
    const year = parseInt(monthIdParts[0], 10);
    const month = parseInt(monthIdParts[1], 10);
    const firstDayOfMonth = createLocalDate(year, month, 1);
    totalDays = getDaysInMonth(firstDayOfMonth);
  } catch (error) {
    logger.error("Error calculating days in month:", error);
    totalDays = daysInMonth || 30;
  }

  const currentMonthId = getCurrentMonthId();
  // If it's not the current month, show 100% progress
  if (monthId !== currentMonthId) {
    return {
      progress: 100,
      daysPassed: totalDays,
      totalDays: totalDays,
      daysRemaining: 0,
    };
  }

  // Calculate progress for current month
  const now = new Date();
  const daysPassed = now.getDate();
  const progress = Math.round((daysPassed / totalDays) * 100);
  const daysRemaining = totalDays - daysPassed;

  return {
    progress: Math.min(progress, 100),
    daysPassed,
    totalDays,
    daysRemaining,
  };
};

export const MonthProgressBar = ({
  monthId,
  monthName,
  isCurrentMonth,
  daysInMonth,
}) => {
  const progressData = calculateMonthProgress(monthId, daysInMonth);

  if (!monthId) {
    return null;
  }

  const primaryColor = isCurrentMonth
    ? CARD_SYSTEM.COLOR_HEX_MAP.color_default
    : CARD_SYSTEM.COLOR_HEX_MAP.pink;

  return (
    <ChartHeader
      variant="section"
      title={monthName}
      subtitle={isCurrentMonth ? "Current Month" : "Past Month"}
      badges={[
        `${progressData.progress}%`,
        `${progressData.daysPassed}/${progressData.totalDays} days`,
      ]}
      color={primaryColor}
      showIcon={true}
      className="w-full "
    >
      {/* Progress Bar Section */}
      <div className="my-4">
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressData.progress}%`,
              backgroundColor: primaryColor,
            }}
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="flex items-center justify-between  ">
        <div className="flex items-center space-x-1">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: primaryColor }}
          ></div>
          <span className="text-xs">{progressData.daysPassed} days passed</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-error"></div>
          <span className="text-xs">
            {progressData.daysRemaining} days remaining
          </span>
        </div>
      </div>
    </ChartHeader>
  );
};

export const MonthBoardBanner = () => {
  let appData;
  try {
    appData = useAppDataContext();
  } catch (error) {
    logger.warn(
      "MonthBoardBanner: AppDataContext not available:",
      error.message
    );
    return null;
  }
  const [generateMonthBoard] = useCreateMonthBoard();
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    monthId,
    monthName,
    boardExists,
    startDate,
    endDate,
    daysInMonth,
    isInitialLoading,
  } = appData || {};

  const startDateStr =
    startDate instanceof Date ? startDate.toISOString() : startDate;
  const endDateStr = endDate instanceof Date ? endDate.toISOString() : endDate;

  // Don't show banner if:
  // 1. Still loading initial data
  // 2. Board already exists
  // 3. No month data available

  if (isInitialLoading || boardExists || !monthId || !monthName) {
    return null;
  }

  // Check if user has permission to create boards
  const userCanCreateBoard = canCreateBoard(appData?.user);

  const handleGenerateBoard = async () => {
    setIsGenerating(true);
    try {
      // Extract yearId, year, and month from monthId (format: YYYY-MM)
      const [yearStr, monthStr] = monthId ? monthId.split('-') : [null, null];
      const yearId = yearStr || new Date().getFullYear().toString();
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      
      // Generate boardId like old Firebase: "board_YYYY-MM_timestamp"
      const boardId = `board_${monthId}_${Date.now()}`;
      
      // Prepare month data object for API with all metadata
      const monthData = {
        monthId,
        yearId,
        department: 'design', // Default department
        status: 'active',
        metadata: {
          boardId,
          monthName,
          startDate: startDateStr,
          endDate: endDateStr,
          daysInMonth: daysInMonth || null,
          month,
          year
        }
      };

      const result = await generateMonthBoard(monthData, appData.user);

      if (result.success) {
        showSuccess(`Month board for ${monthName} created successfully!`);
        logger.log("Month board generated successfully", {
          monthId,
          monthName,
        });
      } else {
        showError(result.message || "Failed to create month board");
        logger.error("Month board generation failed", {
          monthId,
          monthName,
          error: result.message,
        });
      }
    } catch (error) {
      const errorMessage = error?.message || "Failed to create month board";
      showError(errorMessage);
      logger.error("Month board generation error", {
        monthId,
        monthName,
        error,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Icons.generic.calendar className="w-4 h-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100">
              Create Month Board
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {userCanCreateBoard 
                ? `Generate the task board for ${monthName} to start tracking tasks`
                : `Contact administrator for creating board`}
            </p>
          </div>
        </div>
        {userCanCreateBoard ? (
          <DynamicButton
            onClick={handleGenerateBoard}
            disabled={isGenerating}
            iconName="add"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-sm"
          >
            {isGenerating ? "Creating..." : "Create Board"}
          </DynamicButton>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 px-4 py-1.5">
            No Permission
          </div>
        )}
      </div>
    </div>
  );
};
