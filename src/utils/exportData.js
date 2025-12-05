import { logger } from "@/utils/logger.js";
import { formatDate, normalizeTimestamp } from "@/utils/dateUtils.js";
import { EXPORT_CONFIG } from "@/constants";

// CSV date format constant (ISO date with time)
const CSV_DATE_FORMAT = "yyyy-MM-dd HH:mm";

/**
 * Format value for CSV export with proper date formatting and empty field handling
 */
const formatValueForCSV = (
  value,
  columnId,
  reporters = [],
  users = [],
  row = null,
  options = {}
) => {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return "-";
  }

  // Handle Done column - calculate difference between task end and start date
  if (columnId === "done") {
    if (!row) return "-";

    // Get start and end dates from the task
    const startDate = row.data_task?.startDate;
    const endDate = row.data_task?.endDate;

    if (startDate && endDate) {
      const normalizedStart = normalizeTimestamp(startDate);
      const normalizedEnd = normalizeTimestamp(endDate);

      if (normalizedStart && normalizedEnd) {
        const diffTime = normalizedEnd.getTime() - normalizedStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays === 0 ? "Same day" : `${diffDays} days`;
      }
    }

    return "-";
  }

  // Handle date columns (excluding done) - use simple date format without nanoseconds
  const dateColumns = ["startDate", "endDate", "dateCreated"];
  if (dateColumns.includes(columnId)) {
    const normalizedDate = normalizeTimestamp(value);
    if (normalizedDate) {
      // Use CSV date format constant
      const formattedDate = formatDate(normalizedDate, CSV_DATE_FORMAT, false);
      return formattedDate !== "N/A" ? formattedDate : "-";
    }
    return "-";
  }

  // Handle createdByName - always show user name instead of UID
  if (columnId === "createdByName") {
    // If value exists, check if it's a UID (long alphanumeric string) or email
    const userUID = row?.userUID || row?.createbyUID;
    const valueToCheck = value || userUID;

    if (valueToCheck && users.length > 0) {
      // Check if value is a UID (typically long alphanumeric strings) or if we have a userUID to match
      const isLikelyUID =
        typeof valueToCheck === "string" &&
        (valueToCheck.length > 20 || valueToCheck.match(/^[a-zA-Z0-9]{20,}$/));

      // Try to find user by UID
      const userByUID = userUID
        ? users.find((u) => {
            const userIdField = u.userUID || u.id;
            return (
              userIdField &&
              typeof userIdField === "string" &&
              userIdField.toLowerCase() === userUID.toLowerCase()
            );
          })
        : null;

      // Try to find user by name/email if value looks like a name/email
      const userByName =
        !isLikelyUID && value
          ? users.find((u) => {
              const userName = u.name || u.email;
              return (
                userName &&
                typeof userName === "string" &&
                userName.toLowerCase() === value.toLowerCase()
              );
            })
          : null;

      // Return resolved user name
      if (userByUID) {
        return userByUID.name || userByUID.email || "-";
      }
      if (userByName) {
        return userByName.name || userByName.email || "-";
      }

      // If value exists and doesn't look like a UID, return it (it's likely already a name)
      if (value && !isLikelyUID) {
        return value;
      }
    }

    // Fallback to value if it exists
    return value || "-";
  }

  // Handle date created with simple format - handle ISO timestamps
  if (columnId === "createdAt") {
    // Handle PostgreSQL timestamp (ISO string or Date object)
    const normalizedDate = normalizeTimestamp(value);
    if (normalizedDate) {
      // Use CSV date format constant
      const formattedDate = formatDate(normalizedDate, CSV_DATE_FORMAT, false);
      return formattedDate !== "N/A" ? formattedDate : "-";
    }
    return "-";
  }

  // Handle boolean columns (VIP, ReWorked)
  if (columnId === "isVip" || columnId === "reworked") {
    return value ? "Yes" : "No";
  }

  // Handle AI Models array - join as single row
  if (columnId === "aiModels" && Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "-";
  }

  // Handle Markets array - join as single row (uppercase)
  if (columnId === "markets") {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map(m => String(m).toUpperCase()).join(", ") : "-";
    } else if (typeof value === "string" && value) {
      return value.toUpperCase();
    }
    return "-";
  }

  // Handle deliverables object - format with full details matching table display
  if (columnId === "deliverables" && typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "-";

      // Get deliverables options from row context if available
      const deliverablesOptions = row?.deliverablesOptions || options?.deliverables || [];
      
      let formattedDeliverables = [];

      value.forEach((deliverable) => {
        if (!deliverable || typeof deliverable !== "object") return;
        
        const deliverableName = deliverable?.name;
        const quantity = deliverable?.count || 1;
        
        if (!deliverableName) return;

        // Find deliverable in options to get time calculation
        const deliverableOption = deliverablesOptions.find(
          (d) => d.value && d.value.toLowerCase().trim() === deliverableName.toLowerCase().trim()
        );

        if (deliverableOption) {
          const timePerUnit = deliverableOption.timePerUnit || 1;
          const timeUnit = deliverableOption.timeUnit || 'hr';
          const requiresQuantity = deliverableOption.requiresQuantity || false;
          
          // Only use variations if requiresQuantity is true
          const variationsTime = (requiresQuantity && deliverableOption.variationsTime) || 0;
          const variationsTimeUnit = deliverableOption.variationsTimeUnit || 'min';
          const variationsQuantity = (requiresQuantity && (deliverable?.variationsCount || deliverable?.variationsQuantity || 0)) || 0;

          // Convert to minutes (base unit)
          let timeInMinutes = timePerUnit;
          if (timeUnit === 'hr') timeInMinutes = timePerUnit * 60;
          else if (timeUnit === 'min') timeInMinutes = timePerUnit;

          // Calculate variations time
          let variationsTimeInMinutes = 0;
          if (requiresQuantity && variationsTime > 0) {
            if (variationsTimeUnit === 'min') variationsTimeInMinutes = variationsTime;
            else if (variationsTimeUnit === 'hr') variationsTimeInMinutes = variationsTime * 60;
            else variationsTimeInMinutes = variationsTime;
          }

          const totalvariationsTimeInMinutes = variationsQuantity * variationsTimeInMinutes;
          const calculatedTimeInMinutes = (timeInMinutes * quantity) + totalvariationsTimeInMinutes;
          const calculatedTimeInHours = calculatedTimeInMinutes / 60;
          const calculatedTimeInDays = calculatedTimeInMinutes / 480; // 8 hours = 480 minutes

          // Format as: "2xDesign update\n1hr × 2\nTotal: 2.0h (0.25 days)"
          let formatted = `${quantity}x${deliverableName}`;
          
          // Add variations if present
          if (variationsQuantity > 0) {
            formatted += ` + ${variationsQuantity} variations`;
          }
          
          formatted += `\n${timePerUnit}${timeUnit} × ${quantity}`;
          
          // Add variations time if present
          if (variationsQuantity > 0 && variationsTimeInMinutes > 0) {
            formatted += ` + ${variationsQuantity} × ${variationsTimeInMinutes.toFixed(0)}min`;
          }
          
          formatted += `\nTotal: ${calculatedTimeInHours.toFixed(1)}h (${calculatedTimeInDays.toFixed(2)} days)`;
          
          formattedDeliverables.push(formatted);
        } else {
          // Deliverable not configured - just show name and count
          formattedDeliverables.push(`${quantity}x${deliverableName}`);
        }
      });

      if (formattedDeliverables.length === 0) return "-";

      return formattedDeliverables.join("\n\n");
    }

    // Handle single deliverable object
    if (value && typeof value === "object") {
      const deliverableName = value?.name;
      const quantity = value?.count || 1;
      
      if (!deliverableName) return "-";
      
      // Get deliverables options from row context if available
      const deliverablesOptions = row?.deliverablesOptions || options?.deliverables || [];
      const deliverableOption = deliverablesOptions.find(
        (d) => d.value && d.value.toLowerCase().trim() === deliverableName.toLowerCase().trim()
      );

      if (deliverableOption) {
        const timePerUnit = deliverableOption.timePerUnit || 1;
        const timeUnit = deliverableOption.timeUnit || 'hr';
        const requiresQuantity = deliverableOption.requiresQuantity || false;
        
        const variationsTime = (requiresQuantity && deliverableOption.variationsTime) || 0;
        const variationsTimeUnit = deliverableOption.variationsTimeUnit || 'min';
        const variationsQuantity = (requiresQuantity && (value?.variationsCount || value?.variationsQuantity || 0)) || 0;

        let timeInMinutes = timePerUnit;
        if (timeUnit === 'hr') timeInMinutes = timePerUnit * 60;
        else if (timeUnit === 'min') timeInMinutes = timePerUnit;

        let variationsTimeInMinutes = 0;
        if (requiresQuantity && variationsTime > 0) {
          if (variationsTimeUnit === 'min') variationsTimeInMinutes = variationsTime;
          else if (variationsTimeUnit === 'hr') variationsTimeInMinutes = variationsTime * 60;
          else variationsTimeInMinutes = variationsTime;
        }

        const totalvariationsTimeInMinutes = variationsQuantity * variationsTimeInMinutes;
        const calculatedTimeInMinutes = (timeInMinutes * quantity) + totalvariationsTimeInMinutes;
        const calculatedTimeInHours = calculatedTimeInMinutes / 60;
        const calculatedTimeInDays = calculatedTimeInMinutes / 480;

        let formatted = `${quantity}x${deliverableName}`;
        if (variationsQuantity > 0) {
          formatted += ` + ${variationsQuantity} variations`;
        }
        formatted += `\n${timePerUnit}${timeUnit} × ${quantity}`;
        if (variationsQuantity > 0 && variationsTimeInMinutes > 0) {
          formatted += ` + ${variationsQuantity} × ${variationsTimeInMinutes.toFixed(0)}min`;
        }
        formatted += `\nTotal: ${calculatedTimeInHours.toFixed(1)}h (${calculatedTimeInDays.toFixed(2)} days)`;
        
        return formatted;
      }
      
      return `${quantity}x${deliverableName}`;
    }
    return "-";
  }

  // Handle Jira Link - make it a full clickable URL
  if (columnId === "taskName" || columnId === "jiraLink") {
    if (!value) return "-";

    // If it's already a full URL, return it
    if (
      typeof value === "string" &&
      (value.startsWith("http://") || value.startsWith("https://"))
    ) {
      return value;
    }

    // Extract JIRA base URL from validation pattern: https://gmrd.atlassian.net/browse/
    const jiraBaseUrl = "https://gmrd.atlassian.net/browse";

    // If it's a Jira ticket number (like GIMODEAR-123), make it a full URL
    if (typeof value === "string" && value.match(/^[A-Z]+-\d+$/)) {
      return `${jiraBaseUrl}/${value}`;
    }

    // If it's just a number, assume it's a ticket number and add GIMODEAR prefix
    if (typeof value === "string" && value.match(/^\d+$/)) {
      return `${jiraBaseUrl}/GIMODEAR-${value}`;
    }

    return value;
  }

  // Handle reporter - show name instead of UID/ID
  if (columnId === "reporters") {
    // If it's already a name, return it
    if (
      typeof value === "string" &&
      !value.includes("@") &&
      !value.includes("UID") &&
      !value.match(/^[a-zA-Z0-9]{20,}$/i)
    ) {
      return value;
    }
    // If it's a UID/ID, look it up from the reporters data
    if (typeof value === "string" && reporters.length > 0) {
      const reporter = reporters.find((r) => {
        const reporterIdField = r.reporterUID;
        return (
          reporterIdField &&
          typeof reporterIdField === "string" &&
          reporterIdField.toLowerCase() === value.toLowerCase()
        );
      });
      return reporter?.name || value;
    }
    return value || "-";
  }

  // Handle observations
  if (columnId === "observations") {
    return value && value.trim() ? value : "-";
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("; ") : "-";
  }

  // Handle objects
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  // Handle strings
  const stringValue = String(value);
  if (stringValue.trim() === "") {
    return "-";
  }

  return stringValue;
};

/**
 * Calculate deliverables count and total hours from deliverablesUsed
 */
const calculateDeliverablesInfo = (deliverablesUsed, deliverablesOptions = []) => {
  if (!deliverablesUsed || !Array.isArray(deliverablesUsed) || deliverablesUsed.length === 0) {
    return { count: 0, hours: 0 };
  }

  let totalCount = 0;
  let totalHours = 0;

  deliverablesUsed.forEach((deliverable) => {
    const deliverableName = deliverable?.name;
    const quantity = deliverable?.count || 1;
    totalCount += quantity;

    // Find deliverable in options to get time calculation
    if (deliverableName && deliverablesOptions.length > 0) {
      const deliverableOption = deliverablesOptions.find(
        (d) => d.value && d.value.toLowerCase().trim() === deliverableName.toLowerCase().trim()
      );

      if (deliverableOption) {
        const timePerUnit = deliverableOption.timePerUnit || 1;
        const timeUnit = deliverableOption.timeUnit || 'hr';
        const requiresQuantity = deliverableOption.requiresQuantity || false;
        
        // Only use variations if requiresQuantity is true
        const variationsTime = (requiresQuantity && deliverableOption.variationsTime) || 0;
        const variationsTimeUnit = deliverableOption.variationsTimeUnit || 'min';
        const variationsQuantity = (requiresQuantity && (deliverable?.variationsCount || deliverable?.variationsQuantity || 0)) || 0;

        // Convert to minutes (base unit)
        let timeInMinutes = timePerUnit;
        if (timeUnit === 'hr') timeInMinutes = timePerUnit * 60;

        // Add variations time if present and requiresQuantity is true
        let variationsTimeInMinutes = 0;
        if (requiresQuantity && variationsTime > 0) {
          if (variationsTimeUnit === 'min') variationsTimeInMinutes = variationsTime;
          else if (variationsTimeUnit === 'hr') variationsTimeInMinutes = variationsTime * 60;
          else variationsTimeInMinutes = variationsTime;
        }

        const totalvariationsTimeInMinutes = variationsQuantity * variationsTimeInMinutes;
        const calculatedTimeInMinutes = (timeInMinutes * quantity) + totalvariationsTimeInMinutes;
        const calculatedTimeInHours = calculatedTimeInMinutes / 60;
        totalHours += calculatedTimeInHours;
      }
    }
  });

  return { count: totalCount, hours: totalHours };
};

/**
 * Custom CSV export for tasks - only specific columns
 */
// Export function for user-specific export (different column order)
export const exportTasksToCSVForUser = (data, options = {}) => {
  try {
    const {
      filename = null,
      includeHeaders = true,
      deliverables = [],
    } = options;

    const delimiter = EXPORT_CONFIG.CSV_DELIMITER;

    // Define custom headers - user export order: JIRA LINK, DEPARTMENT, MARKET, TOTAL HOURS, DELIVERABLES
    const headers = [
      "JIRA LINK",
      "DEPARTMENT",
      "MARKET",
      "TOTAL HOURS",
      "DELIVERABLES"
    ];

    // Create rows with only the specified columns
    const rows = data.map((row) => {
      const taskData = row.data_task || row;

      // 1. JIRA LINK
      const taskName = taskData.taskName;
      let jiraLink = "-";
      if (taskName) {
        if (taskName.startsWith("http://") || taskName.startsWith("https://")) {
          jiraLink = taskName;
        } else if (taskName.match(/^[A-Z]+-\d+$/)) {
          jiraLink = `https://gmrd.atlassian.net/browse/${taskName}`;
        } else {
          jiraLink = taskName;
        }
      }

      // 2. Department
      const departments = taskData.departments;
      let departmentValue = "-";
      if (Array.isArray(departments) && departments.length > 0) {
        departmentValue = departments.join(", ");
      } else if (typeof departments === "string" && departments) {
        departmentValue = departments;
      }

      // 3. MARKET
      const markets = taskData.markets;
      let marketValue = "-";
      if (Array.isArray(markets) && markets.length > 0) {
        marketValue = markets.map(m => String(m).toUpperCase()).join(", ");
      } else if (typeof markets === "string" && markets) {
        marketValue = markets.toUpperCase();
      }

      // 4. TOTAL HOURS (excluding AI hours)
      const timeInHours = taskData.timeInHours || 0;
      const aiTime = taskData.aiUsed?.[0]?.aiTime || 0;
      const totalHours = Math.max(0, (typeof timeInHours === "number" ? timeInHours : 0) - (typeof aiTime === "number" ? aiTime : 0));
      const totalHoursValue = totalHours > 0 ? totalHours.toFixed(1) : "0";

      // 5. Deliverables (names only, comma-separated)
      const deliverablesUsed = taskData.deliverablesUsed || [];
      const deliverableNames = [];
      
      if (Array.isArray(deliverablesUsed) && deliverablesUsed.length > 0) {
        deliverablesUsed.forEach((deliverable) => {
          const deliverableName = deliverable?.name;
          if (deliverableName) {
            deliverableNames.push(deliverableName);
          }
        });
      }
      
      const deliverableNamesValue = deliverableNames.length > 0 
        ? deliverableNames.join(", ") 
        : "-";

      // Escape values that contain delimiter, quotes, or newlines
      const escapeValue = (value) => {
        const stringValue = String(value);
        if (
          stringValue.includes(delimiter) ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      return [
        escapeValue(jiraLink),
        escapeValue(departmentValue),
        escapeValue(marketValue),
        escapeValue(totalHoursValue),
        escapeValue(deliverableNamesValue)
      ].join(delimiter);
    });

    // Create CSV content
    let csvContent = "";
    if (includeHeaders) {
      csvContent = [headers.join(delimiter), ...rows].join("\n");
    } else {
      csvContent = rows.join("\n");
    }

    // Create and download file
    const blob = new Blob([csvContent], {
      type: `text/csv;charset=${EXPORT_CONFIG.CSV_ENCODING};`,
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Use custom filename or generate default
    const exportFilename =
      filename ||
      `tasks_user_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("download", exportFilename);

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    logger.error("Error exporting tasks to CSV for user:", error);
    return false;
  }
};

const exportTasksToCSV = (data, options = {}) => {
  try {
    const {
      filename = null,
      includeHeaders = true,
      deliverables = [],
    } = options;

    // Transform deliverables to the format expected by calculateDeliverablesInfo
    const deliverablesOptions = deliverables.map(deliverable => ({
      value: deliverable.name,
      label: deliverable.name,
      department: deliverable.department,
      timePerUnit: deliverable.timePerUnit,
      timeUnit: deliverable.timeUnit,
      requiresQuantity: deliverable.requiresQuantity,
      variationsTime: deliverable.variationsTime,
      variationsTimeUnit: deliverable.variationsTimeUnit || 'min'
    }));

    const delimiter = EXPORT_CONFIG.CSV_DELIMITER;

    // Define custom headers - only these columns always
    const headers = [
      "DEPARTMENT",
      "JIRA LINK",
      "MARKET",
      "TOTAL HOURS",
      "DELIVERABLES"
    ];

    // Create rows with only the specified columns
    const rows = data.map((row) => {
      const taskData = row.data_task || row;

      // 1. Department
      const departments = taskData.departments;
      let departmentValue = "-";
      if (Array.isArray(departments) && departments.length > 0) {
        departmentValue = departments.join(", ");
      } else if (typeof departments === "string" && departments) {
        departmentValue = departments;
      }

      // 2. JIRA LINK
      const taskName = taskData.taskName;
      let jiraLink = "-";
      if (taskName) {
        if (taskName.startsWith("http://") || taskName.startsWith("https://")) {
          jiraLink = taskName;
        } else if (taskName.match(/^[A-Z]+-\d+$/)) {
          jiraLink = `https://gmrd.atlassian.net/browse/${taskName}`;
        } else {
          jiraLink = taskName;
        }
      }

      // 3. MARKET
      const markets = taskData.markets;
      let marketValue = "-";
      if (Array.isArray(markets) && markets.length > 0) {
        marketValue = markets.map(m => String(m).toUpperCase()).join(", ");
      } else if (typeof markets === "string" && markets) {
        marketValue = markets.toUpperCase();
      }

      // 4. TOTAL HOURS (excluding AI hours)
      const timeInHours = taskData.timeInHours || 0;
      const aiTime = taskData.aiUsed?.[0]?.aiTime || 0;
      const totalHours = Math.max(0, (typeof timeInHours === "number" ? timeInHours : 0) - (typeof aiTime === "number" ? aiTime : 0));
      const totalHoursValue = totalHours > 0 ? totalHours.toFixed(1) : "0";

      // 5. Deliverables (names only, comma-separated)
      const deliverablesUsed = taskData.deliverablesUsed || [];
      const deliverableNames = [];
      
      if (Array.isArray(deliverablesUsed) && deliverablesUsed.length > 0) {
        deliverablesUsed.forEach((deliverable) => {
          const deliverableName = deliverable?.name;
          if (deliverableName) {
            deliverableNames.push(deliverableName);
          }
        });
      }
      
      const deliverableNamesValue = deliverableNames.length > 0 
        ? deliverableNames.join(", ") 
        : "-";

      // Escape values that contain delimiter, quotes, or newlines
      const escapeValue = (value) => {
        const stringValue = String(value);
        if (
          stringValue.includes(delimiter) ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      return [
        escapeValue(departmentValue),
        escapeValue(jiraLink),
        escapeValue(marketValue),
        escapeValue(totalHoursValue),
        escapeValue(deliverableNamesValue)
      ].join(delimiter);
    });

    // Create CSV content
    let csvContent = "";
    if (includeHeaders) {
      csvContent = [headers.join(delimiter), ...rows].join("\n");
    } else {
      csvContent = rows.join("\n");
    }

    // Create and download file
    const blob = new Blob([csvContent], {
      type: `text/csv;charset=${EXPORT_CONFIG.CSV_ENCODING};`,
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Use custom filename or generate default
    const exportFilename =
      filename ||
      `tasks_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("download", exportFilename);

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    logger.error("Error exporting tasks CSV:", error);
    return false;
  }
};

/**
 * Unified CSV Export utility function
 * Handles both table data and analytics data exports
 */
export const exportToCSV = (data, columns, tableType, options = {}) => {
  try {
    const {
      filename = null,
      includeHeaders = true,
      analyticsMode = false,
      reporters = [],
      users = [],
      deliverables = [],
      hasActiveFilters = false, // New option to detect if filters are active
    } = options;

    // Handle analytics data (array of objects without columns)
    if (analyticsMode || !columns) {
      return exportAnalyticsToCSV(data, tableType, {
        filename,
        includeHeaders,
      });
    }

    // Transform deliverables to the format expected by formatValueForCSV
    // This is used for tasks table exports
    const deliverablesOptions = deliverables && deliverables.length > 0
      ? deliverables.map(deliverable => ({
          value: deliverable.name,
          label: deliverable.name,
          department: deliverable.department,
          timePerUnit: deliverable.timePerUnit,
          timeUnit: deliverable.timeUnit,
          requiresQuantity: deliverable.requiresQuantity,
          variationsTime: deliverable.variationsTime,
          variationsTimeUnit: deliverable.variationsTimeUnit || 'min'
        }))
      : [];

    // Custom export for tasks - dynamic based on filters
    // If filters are active: export all visible columns
    // If no filters: export only specific columns (DEPARTMENT, JIRA LINK, MARKET, TOTAL HOURS, DELIVERABLES)
    if (tableType === "tasks") {

      // If filters are active, use generic export with all visible columns
      if (hasActiveFilters) {
        // Get all visible columns (excluding select and actions)
        const visibleColumns = columns.filter(
          (col) => col.id !== "select" && col.id !== "actions"
        );

        // Create headers from visible columns
        const headers = visibleColumns
          .map((col) => {
            if (typeof col.header === "string") return col.header;
            if (typeof col.header === "function") return col.accessorKey || col.id;
            return col.accessorKey || col.id;
          })
          .join(EXPORT_CONFIG.CSV_DELIMITER);

        // Create rows
        const rows = data.map((row) => {
          return visibleColumns
            .map((col) => {
              let value;

              // Handle different accessor types
              if (typeof col.accessorFn === "function") {
                value = col.accessorFn(row);
              } else if (col.accessorKey) {
                if (col.accessorKey.includes(".")) {
                  const keys = col.accessorKey.split(".");
                  value = keys.reduce((obj, key) => obj?.[key], row);
                } else {
                  value = row[col.accessorKey];
                }
              } else {
                value = null;
              }

              // Format the value using our custom formatter
              const columnId =
                col.id ||
                (col.accessorKey?.includes(".")
                  ? col.accessorKey.split(".").pop()
                  : col.accessorKey) ||
                "";
              const formattedValue = formatValueForCSV(
                value,
                columnId,
                reporters,
                users,
                row,
                { deliverables: deliverablesOptions }
              );

              // Escape delimiter, quotes, and newlines
              const delimiter = EXPORT_CONFIG.CSV_DELIMITER;
              if (
                formattedValue.includes(delimiter) ||
                formattedValue.includes('"') ||
                formattedValue.includes("\n")
              ) {
                return `"${formattedValue.replace(/"/g, '""')}"`;
              }
              return formattedValue;
            })
            .join(EXPORT_CONFIG.CSV_DELIMITER);
        });

        // Create CSV content
        let csvContent = "";
        if (includeHeaders) {
          csvContent = [headers, ...rows].join("\n");
        } else {
          csvContent = rows.join("\n");
        }

        // Create and download file
        const blob = new Blob([csvContent], {
          type: `text/csv;charset=${EXPORT_CONFIG.CSV_ENCODING};`,
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);

        const exportFilename =
          filename ||
          `tasks_export_${new Date().toISOString().split("T")[0]}.csv`;
        link.setAttribute("download", exportFilename);

        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return true;
      } else {
        // No filters active - use custom export with specific columns only
        return exportTasksToCSV(data, {
          filename,
          includeHeaders,
          deliverables,
        });
      }
    }

    // Get all columns (both visible and hidden) excluding only the select column
    const allColumns = columns.filter(
      (col) => col.id !== "select" && col.id !== "actions"
    );

    // Debug logging removed

    // Create headers
    const headers = allColumns
      .map((col) => {
        // Handle different header types
        if (typeof col.header === "string") return col.header;
        if (typeof col.header === "function") return col.accessorKey || col.id;
        return col.accessorKey || col.id;
      })
      .join(EXPORT_CONFIG.CSV_DELIMITER);

    // Create rows
    const rows = data.map((row) => {
      return allColumns
        .map((col) => {
          let value;

          // Handle different accessor types
          if (typeof col.accessorFn === "function") {
            // Function accessor: (row) => row.data_task?.departments
            value = col.accessorFn(row);
          } else if (col.accessorKey) {
            // Simple accessor key: 'data_task.taskName'
            if (col.accessorKey.includes(".")) {
              // Nested accessor: 'data_task.taskName'
              const keys = col.accessorKey.split(".");
              value = keys.reduce((obj, key) => obj?.[key], row);
            } else {
              // Direct accessor
              value = row[col.accessorKey];
            }
          } else {
            value = null;
          }
          // Format the value using our custom formatter
          // Use id if available, otherwise derive from accessorKey (e.g., 'data_task.taskName' -> 'taskName')
          const columnId =
            col.id ||
            (col.accessorKey?.includes(".")
              ? col.accessorKey.split(".").pop()
              : col.accessorKey) ||
            "";
          const formattedValue = formatValueForCSV(
            value,
            columnId,
            reporters,
            users,
            row,
            { deliverables: deliverablesOptions }
          );

          // Escape delimiter, quotes, and newlines in string values
          const delimiter = EXPORT_CONFIG.CSV_DELIMITER;
          if (
            formattedValue.includes(delimiter) ||
            formattedValue.includes('"') ||
            formattedValue.includes("\n")
          ) {
            return `"${formattedValue.replace(/"/g, '""')}"`;
          }
          return formattedValue;
        })
        .join(EXPORT_CONFIG.CSV_DELIMITER);
    });

    // Add totals row for task table only
    let csvContent = [headers, ...rows].join("\n");

    if (tableType === "tasks" && data.length > 0) {
      // Calculate totals
      const totalTasks = data.length;
      let totalHR = 0;
      let totalAIHR = 0;
      const marketsSet = new Set();
      const productsSet = new Set();

      data.forEach((task) => {
        // Sum total HR
        const taskHR = task.data_task?.timeInHours || 0;
        totalHR += typeof taskHR === "number" ? taskHR : 0;

        // Sum total AI HR
        const aiUsed = task.data_task?.aiUsed?.[0];
        if (aiUsed?.aiTime) {
          totalAIHR += typeof aiUsed.aiTime === "number" ? aiUsed.aiTime : 0;
        }

        // Collect unique markets
        const markets = task.data_task?.markets;
        if (Array.isArray(markets)) {
          markets.forEach((market) => {
            if (market) marketsSet.add(market);
          });
        }

        // Collect unique products
        const product = task.data_task?.products;
        if (product) {
          productsSet.add(product);
        }
      });

      // Create totals row
      const delimiter = EXPORT_CONFIG.CSV_DELIMITER;
      const totalsRow = allColumns
        .map((col) => {
          const header =
            typeof col.header === "string"
              ? col.header
              : col.accessorKey || col.id;

          if (header === "JIRA LINK") {
            return "TOTALS";
          } else if (header === "MARKETS") {
            return Array.from(marketsSet).join(", ");
          } else if (header === "PRODUCT") {
            return Array.from(productsSet).join(", ");
          } else if (header === "TASK HR") {
            return `Total: ${totalHR.toFixed(1)}`;
          } else if (header === "AI MODELS") {
            return `Total AI HR: ${totalAIHR.toFixed(1)}`;
          } else if (header === "CREATED BY") {
            return `Total Tasks: ${totalTasks}`;
          } else {
            return "";
          }
        })
        .join(delimiter);

      csvContent = [headers, ...rows, totalsRow].join("\n");
    }

    // Create and download file
    const blob = new Blob([csvContent], {
      type: `text/csv;charset=${EXPORT_CONFIG.CSV_ENCODING};`,
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Use custom filename or generate default
    const exportFilename =
      filename ||
      `${tableType}_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("download", exportFilename);

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    logger.error("Error exporting CSV:", error);
    return false;
  }
};

/**
 * Export analytics data to CSV
 * @param {Array|Object} data - Analytics data to export
 * @param {string} tableType - Type of data being exported
 * @param {Object} options - Export options
 * @returns {boolean} Success status
 */
export const exportAnalyticsToCSV = (data, tableType, options = {}) => {
  try {
    const { filename = null, includeHeaders = true } = options;

    let csvContent = "";

    // Handle different data structures
    if (Array.isArray(data)) {
      // Array of objects - create CSV from array
      if (data.length === 0) {
        csvContent = "No data available";
      } else {
        const headers = Object.keys(data[0]);
        const rows = data.map((item) =>
          headers
            .map((header) => {
              const value = item[header];
              if (value === null || value === undefined) return "";
              if (typeof value === "object") {
                return JSON.stringify(value);
              }
              const stringValue = String(value);
              const delimiter = EXPORT_CONFIG.CSV_DELIMITER;
              if (
                stringValue.includes(delimiter) ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(EXPORT_CONFIG.CSV_DELIMITER)
        );

        if (includeHeaders) {
          csvContent = [
            headers.join(EXPORT_CONFIG.CSV_DELIMITER),
            ...rows,
          ].join("\n");
        } else {
          csvContent = rows.join("\n");
        }
      }
    } else if (typeof data === "object") {
      // Object data - create key-value pairs
      const delimiter = EXPORT_CONFIG.CSV_DELIMITER;
      const entries = Object.entries(data);
      const rows = entries.map(([key, value]) => {
        const stringValue =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        const escapedValue =
          stringValue.includes(delimiter) ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
            ? `"${stringValue.replace(/"/g, '""')}"`
            : stringValue;
        return `${key}${delimiter}${escapedValue}`;
      });

      if (includeHeaders) {
        csvContent = [`Key${delimiter}Value`, ...rows].join("\n");
      } else {
        csvContent = rows.join("\n");
      }
    } else {
      csvContent = "Invalid data format";
    }

    // Create and download file
    const blob = new Blob([csvContent], {
      type: `text/csv;charset=${EXPORT_CONFIG.CSV_ENCODING};`,
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const exportFilename =
      filename ||
      `${tableType}_analytics_${new Date().toISOString().split("T")[0]}.csv`;
    link.setAttribute("download", exportFilename);

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    logger.error("Error exporting analytics CSV:", error);
    return false;
  }
};
