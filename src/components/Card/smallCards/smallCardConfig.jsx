import { Icons } from "@/components/icons";
import DynamicButton from "@/components/ui/Button/DynamicButton";
import SearchableSelectField from "@/components/forms/components/SearchableSelectField";
import { getWeeksInMonth } from "@/utils/monthUtils";
import { CARD_SYSTEM } from "@/constants";
import { logger } from "@/utils/logger";
import { matchesUser, getTaskReporterId, filterTasksByUserAndReporter } from "@/utils/taskFilters";

export const getCardColor = (cardType, data = {}) => {
  const palette = [
    "green",
    "blue",
    "purple",
    "amber",
    "pink",
    "red",
    "yellow",
    "orange",
    "crimson",
  ].filter((key) => Boolean(CARD_SYSTEM.COLOR_HEX_MAP[key]));
  // Fallback if palette is somehow empty
  if (palette.length === 0) return "color_default";
  const hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
  const index = hashString(String(cardType)) % palette.length;
  return palette[index];
};


export const convertMarketsToBadges = (markets, defaultCount = 1) => {
  if (!markets) return null;

  // If already an object (badges format), return as-is (same as smallCardConfig pattern)
  if (typeof markets === "object" && !Array.isArray(markets)) {
    const keys = Object.keys(markets);
    return keys.length > 0 ? markets : null;
  }

  // Handle array - convert to object format
  let marketsArray = [];
  if (Array.isArray(markets)) {
    marketsArray = markets;
  } else if (typeof markets === "string") {
    // Handle comma-separated string
    marketsArray = markets
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
  } else {
    return null;
  }

  if (marketsArray.length === 0) return null;

  // Convert array to object with default count for each market (same pattern as analytics configs)
  const badgesObj = {};
  marketsArray.forEach((market) => {
    if (market) {
      const marketKey =
        typeof market === "string" ? market.trim() : String(market);
      if (marketKey) {
        badgesObj[marketKey] = defaultCount;
      }
    }
  });

  return Object.keys(badgesObj).length > 0 ? badgesObj : null;
};

// Small Card Types
export const SMALL_CARD_TYPES = CARD_SYSTEM.SMALL_CARD_TYPES;

// Small Card Configuration Templates
export const SMALL_CARD_CONFIGS = {
  [SMALL_CARD_TYPES.MONTH_SELECTION]: {
    title: "Month Period",
    subtitle: "View All",
    description: "Months",
    icon: Icons.generic.clock,
    color: "blue",
    getValue: (data) => data.availableMonths?.length || 0,
    getStatus: (data) => (data.isCurrentMonth ? "Current" : "History"),
    getBadge: (data) => ({
      text: data.isCurrentMonth ? "Current" : "History",
      color: "blue",
    }),
    getContent: (data) => (
      <div className="">
        <SearchableSelectField
          field={{
            name: "selectedMonth",
            type: "select",
            label: "Select Month",
            required: false,
            options:
              data.availableMonths?.map((month) => {
                const isCurrent = month.isCurrent || month.monthId === data.currentMonth?.monthId;
                return {
                  value: month.monthId,
                  label: `${month.monthName || month.monthId}${isCurrent ? " (Current)" : ""}`,
                };
              }) || [],
            placeholder: "Search months...",
          }}
          register={() => {}} // Not needed for this use case
          errors={{}}
          setValue={(fieldName, value) => {
            if (fieldName === "selectedMonth" && data.selectMonth) {
              data.selectMonth(value);
            }
          }}
          watch={() =>
            data.selectedMonth?.monthId || data.currentMonth?.monthId || ""
          }
          trigger={() => {}}
          clearErrors={() => {}}
          formValues={{}}
          noOptionsMessage="No months available"
          variant="blue"
        />
      </div>
    ),
    getDetails: (data) => [
      {
        icon: Icons.generic.clock,
        label: "Current",
        value: data.isCurrentMonth ? "Yes" : "No",
      },
      {
        icon: Icons.generic.calendar,
        label: "Available",
        value: `${data.availableMonths?.length || 0} months`,
      },
      {
        icon: Icons.generic.clock,
        label: "Period",
        value:
          data.currentMonth?.monthName ||
          "None",
      },
    ],
  },

  [SMALL_CARD_TYPES.USER_FILTER]: {
    title: "User Filter",
    subtitle: "View All",
    description: "Users",
    icon: Icons.generic.user,
    color: "amber",
    getValue: (data) => {
      // Show total number of users, not tasks
      return (data.users?.length || 0).toString();
    },
    getStatus: (data) => {
      if (data.selectedUserId) {
        return data.selectedUserName;
      }
      return "All Users";
    },
    getBadge: (data) => ({
      text: data.selectedUserId ? "Filtered" : "All Users",
      color: "amber",
    }),
    getContent: (data) => (
      <div className=" space-y-3">
        <SearchableSelectField
          field={{
            name: "selectedUser",
            type: "select",
            label: "Select User",
            required: false,
            options:
              data.users?.map((user) => ({
                value: user.userUID || user.id,
                label: user.name || user.email,
              })) || [],
            placeholder: "Search users...",
          }}
          register={() => {}} // Not needed for this use case
          errors={{}}
          setValue={(fieldName, value) => {
            if (fieldName === "selectedUser" && data.handleUserSelect) {
              data.handleUserSelect(value);
            }
          }}
          watch={() => data.selectedUserId || ""}
          trigger={() => {}}
          clearErrors={() => {}}
          formValues={{}}
          noOptionsMessage="No users found"
          variant="amber"
        />
      </div>
    ),
    getDetails: (data) => {
      // Use pre-calculated values from hooks if available, otherwise calculate
      const totalTasks = data.userFilterTotalTasks ?? 0;
      const totalHours = data.userFilterTotalHours ?? 0;
      
      return [
        {
          icon: Icons.generic.user,
          label: "Current User",
          value: data.selectedUserId 
            ? data.selectedUserName 
            : (data.currentUser?.name || data.currentUser?.email || "Current User"),
        },
        {
          icon: Icons.generic.task,
          label: "Total Task",
          value: totalTasks.toString(),
        },
        {
          icon: Icons.generic.clock,
          label: "Total Hr",
          value: `${totalHours.toFixed(1)}h`,
        },
      ];
    },
  },

  [SMALL_CARD_TYPES.REPORTER_FILTER]: {
    title: "Reporter Filter",
    subtitle: "View All",
    description: "Reporters",
    icon: Icons.admin.reporters,
    color: "orange",
    getValue: (data) => {
      return (data.reporters?.length || 0).toString();
    },
    getStatus: (data) => {
      if (data.selectedReporterId) {
        return data.selectedReporterName;
      }
      return "All Reporters";
    },
    getBadge: (data) => ({
      text: data.selectedReporterId
        ? `${data.selectedReporterName}`
        : "All Reporters",
      color: "orange",
    }),
    getContent: (data) => (
      <div className="space-y-1">
        <SearchableSelectField
          field={{
            name: "selectedReporter",
            type: "select",
            label: "Select Reporter",
            required: false,
            options:
              data.reporters?.map((reporter) => ({
                value: reporter.reporterUID,
                label: reporter.name || reporter.reporterName,
              })) || [],
            placeholder: "Search Reporters...",
          }}
          register={() => {}} // Not needed for this use case
          errors={{}}
          setValue={(fieldName, value) => {
            if (fieldName === "selectedReporter" && data.handleReporterSelect) {
              data.handleReporterSelect(value);
            }
          }}
          watch={() => data.selectedReporterId || ""}
          trigger={() => {}}
          clearErrors={() => {}}
          formValues={{}}
          noOptionsMessage="No reporters found"
          variant="orange"
        />
      </div>
    ),
    getDetails: (data) => {
      // Use pre-calculated values from hooks if available
      const totalReporterTasks = data.reporterFilterTotalTasks ?? 0;
      const totalHours = data.reporterFilterTotalHours ?? 0;
      
      return [
        {
          icon: Icons.admin.reporters,
          label: "Selected",
          value: data.selectedReporterId
            ? data.selectedReporterName
            : "0",
        },
        {
          icon: Icons.admin.reporters,
          label: "Total Reporters Task",
          value: totalReporterTasks.toString(),
        },
        {
          icon: Icons.generic.clock,
          label: "Total Hr",
          value: `${totalHours.toFixed(1)}h`,
        },
      ];
    },
  },

  [SMALL_CARD_TYPES.USER_PROFILE]: {
    title: "User Profile",
    subtitle: "View All",
    description: "User Tasks",
    icon: Icons.generic.user,
    color: "pink",
    getBadge: (data) => ({
      text: data.currentUser?.role || "user",
      color: 'pink'
    }),
    getValue: (data) => {
      if (!data.tasks || !Array.isArray(data.tasks)) return "0";
      const selectedUserId = data.selectedUserId;
      const selectedReporterId = data.selectedReporterId;
      const currentMonthId =
        data.selectedMonth?.monthId || data.currentMonth?.monthId;
      const isUserAdmin = data.isUserAdmin || data.currentUser?.role === "admin";
      const currentUserId = data.currentUser?.userUID;
      
      // Determine target user: selected user or current user (never show all tasks)
      const targetUserId = selectedUserId || currentUserId;

      // Use shared utility for filtering
      const filteredTasks = filterTasksByUserAndReporter(data.tasks, {
        selectedUserId: targetUserId,
        selectedReporterId,
        currentMonthId,
        isUserAdmin: data.isUserAdmin || data.currentUser?.role === "admin",
        currentUserUID: currentUserId,
      });
      return filteredTasks.length.toString();
    },
    getStatus: (data) => (data.currentUser?.role || "user").toLowerCase(),
    getDetails: (data) => {
      const details = [];
      // Show selected user info if user is selected
      if (data.selectedUserId) {
        const selectedUser = data.users?.find(
          (u) => (u.userUID || u.id) === data.selectedUserId
        );
        details.push({
          label: "Selected User",
          value: selectedUser?.name || selectedUser?.email || "Unknown User",
        });
      }
      // Show selected reporter info if reporter is selected
      if (data.selectedReporterId) {
        const selectedReporter = data.reporters?.find(
          (r) => r.reporterUID === data.selectedReporterId
        );
        details.push({
          label: "Selected Reporter",
          value:
            selectedReporter?.name ||
            selectedReporter?.reporterName ||
            "Unknown Reporter",
        });
      }
      details.push({
        label: "Current User",
        value: data.currentUser?.name || data.currentUser?.email || "N/A",
      });
      
      // Add selected week section (without "All Weeks")
      const monthId = data.selectedMonth?.monthId || data.currentMonth?.monthId;
      if (monthId) {
        try {
          // Show selected week
          const selectedWeek = data.selectedWeek;
          details.push({
            label: "Selected Week",
            value: selectedWeek 
              ? `Week ${selectedWeek.weekNumber}` 
              : "All Weeks",
            icon: Icons.generic.calendar,
          });
        } catch (error) {
          logger.warn("Error getting weeks for USER_PROFILE card:", error);
          details.push({
            label: "Selected Week",
            value: "All Weeks",
            icon: Icons.generic.calendar,
          });
        }
      } else {
        // No month selected, show default
        details.push({
          label: "Selected Week",
          value: "All Weeks",
          icon: Icons.generic.calendar,
        });
      }
      
      return details;
    },
    getContent: (data) => (
      <div className="mt-2">
        <DynamicButton
          onClick={() => {
            // Build URL parameters based on current selections
            const params = new URLSearchParams();
            // Handle user selection - always show current user's data by default
            if (data.selectedUserId && data.currentUser?.role === "admin") {
              // Admin viewing specific user
              const selectedUser = data.users?.find(
                (u) => u.userUID === data.selectedUserId
              );
              const userName =
                selectedUser?.name || selectedUser?.email || "Unknown";
              params.set("user", userName);
            } else {
              // Always show current user's data by default
              const userName =
                data.currentUser?.name || data.currentUser?.email || "My Data";
              params.set("user", userName);
            }
            // Handle reporter selection
            if (data.selectedReporterId) {
              const selectedReporter = data.reporters?.find(
                (r) => r.reporterUID === data.selectedReporterId
              );
              const reporterName =
                selectedReporter?.name ||
                selectedReporter?.reporterName ||
                "Unknown Reporter";
              params.set("reporter", reporterName);
            }
            // Week selection logic is REMOVED

            // Handle month selection
            if (data.selectedMonth?.monthId) {
              params.set("month", data.selectedMonth.monthId);
            } else if (data.currentMonth?.monthId) {
              params.set("month", data.currentMonth.monthId);
            }
            const url = `/analytics-detail?${params.toString()}`;
            if (data.navigate) {
              data.navigate(url);
            } else {
              window.history.pushState({}, "", url);
              window.dispatchEvent(new PopStateEvent("popstate"));
            }
          }}
          iconName="view"
          variant="primary"
          size="sm"
          className="w-full uppercase"
        >
          {(() => {
            const parts = [];
            // User part - always show current user data
            if (data.selectedUserId && data.currentUser?.role === "admin") {
              // Admin viewing specific user
              const selectedUser = data.users?.find(
                (u) => u.userUID === data.selectedUserId
              );
              const userName =
                selectedUser?.name?.toUpperCase() ||
                selectedUser?.email?.toUpperCase() ||
                "USER";
              parts.push(userName);
            } else {
              // Always show current user data
              const currentUserName =
                data.currentUser?.name?.toUpperCase() ||
                data.currentUser?.email?.toUpperCase() ||
                "MY";
              parts.push(currentUserName);
            }
            // Reporter part - only add if both user and reporter are selected
            if (data.selectedReporterId && data.selectedUserId) {
              const selectedReporter = data.reporters?.find(
                (r) => r.reporterUID === data.selectedReporterId
              );
              const reporterName =
                selectedReporter?.name?.toUpperCase() ||
                selectedReporter?.reporterName?.toUpperCase() ||
                "REPORTER";
              parts.push(reporterName);
            }
            // Build final text
            if (parts.length === 0) {
              // Fallback if somehow no user data is available
              return `VIEW DATA`;
            } else if (parts.length === 1) {
              return ` ${parts[0]} Task`;
            } else {
              return ` ${parts.join(" + ")} Tasks`;
            }
          })()}
        </DynamicButton>

        {/* Second button for all data tasks - admin only */}
        {data.isUserAdmin && (
          <DynamicButton
            onClick={() => {
              // Build URL parameters for ALL data tasks with selected month
              const params = new URLSearchParams();
              // Handle month selection - use selected month or current month
              if (data.selectedMonth?.monthId) {
                params.set("month", data.selectedMonth.monthId);
              } else if (data.currentMonth?.monthId) {
                params.set("month", data.currentMonth.monthId);
              }
              const url = `/analytics-detail?${params.toString()}`;
              if (data.navigate) {
                data.navigate(url);
              } else {
                window.history.pushState({}, "", url);
                window.dispatchEvent(new PopStateEvent("popstate"));
              }
            }}
            iconName="users"
            variant="primary"
            size="sm"
            className="w-full mt-2 uppercase"
          >
            VIEW ALL TASKS
          </DynamicButton>
        )}
      </div>
    ),
  },

  [SMALL_CARD_TYPES.ACTIONS]: {
    title: "Task Statistics",
    subtitle: "View All",
    description: "Total Tasks",
    icon: Icons.buttons.add,
    color: "green",
    getBadge: (data) => ({
      text: data.selectedWeek
        ? `Week ${data.selectedWeek.weekNumber}`
        : "All Weeks",
      color: "green",
    }),
    getValue: (data) => {
      if (!data.tasks || !Array.isArray(data.tasks)) return "0";

      const currentMonthId =
        data.selectedMonth?.monthId || data.currentMonth?.monthId;

      // Show ALL tasks for the selected month (no user/reporter filtering)
      const filteredTasks = data.tasks.filter((task) => {
        // Only filter by month, never by user or reporter
        if (currentMonthId && task.monthId !== currentMonthId) return false;
        return true;
      });

      return filteredTasks.length.toString();
    },
    getStatus: (data) => (data.canCreateTasks ? "Active" : "Disabled"),
    getContent: (data) => {
      // Get weeks for the current month
      const monthId = data.selectedMonth?.monthId || data.currentMonth?.monthId;
      let weekOptions = [];

      if (monthId) {
        try {
          const weeks = getWeeksInMonth(monthId);
          // Add "All Weeks" option at the beginning
          weekOptions = [
            { value: "", label: "All Weeks" },
            ...weeks.map((week) => ({
              value: week.weekNumber.toString(),
              label: `Week ${week.weekNumber}`,
            })),
          ];
        } catch (error) {
          logger.warn("Error getting weeks for month:", error);
        }
      }

      return (
        <div className="">
          <SearchableSelectField
            field={{
              name: "selectedWeek",
              type: "select",
              label: "Filter by Week",
              required: false,
              options: weekOptions,
              placeholder: "Search weeks...",
            }}
            register={() => {}} // Not needed for this use case
            errors={{}}
            setValue={(fieldName, value) => {
              if (fieldName === "selectedWeek" && data.handleWeekChange) {
                if (!value || value === "") {
                  // Clear week selection - show all weeks
                  data.handleWeekChange(null);
                } else {
                  // Select specific week
                  const weekNumber = parseInt(value);
                  const weeks = getWeeksInMonth(monthId);
                  const week = weeks.find((w) => w.weekNumber === weekNumber);
                  if (week) {
                    data.handleWeekChange(week);
                  }
                }
              }
            }}
            watch={() => {
              if (data.selectedWeek) {
                return data.selectedWeek.weekNumber.toString();
              }
              return ""; // Return empty string when no week is selected
            }}
            trigger={() => {}}
            clearErrors={() => {}}
            formValues={{}}
            noOptionsMessage="No weeks available"
            variant="green"
          />
        </div>
      );
    },
    getDetails: (data) => {
      if (!data.tasks || !Array.isArray(data.tasks)) return [];

      const currentMonthId =
        data.selectedMonth?.monthId || data.currentMonth?.monthId;

      // Filter tasks by month first
      let filteredTasks = data.tasks.filter((task) => {
        if (currentMonthId && task.monthId !== currentMonthId) return false;
        return true;
      });

      // If a week is selected, filter by week; otherwise show all tasks for the month
      if (data.selectedWeek && data.selectedWeek.days) {
        const weekTasks = [];
        data.selectedWeek.days.forEach((day) => {
          try {
            const dayDate = day instanceof Date ? day : new Date(day);
            if (isNaN(dayDate.getTime())) return;

            const dayStr = dayDate.toISOString().split("T")[0];
            const dayTasks = filteredTasks.filter((task) => {
              if (!task.createdAt) return false;

              // Handle timestamp (backward compatibility)
              let taskDate;
              if (
                task.createdAt &&
                typeof task.createdAt === "object" &&
                task.createdAt.seconds
              ) {
                taskDate = new Date(task.createdAt.seconds * 1000);
              } else if (
                task.createdAt &&
                typeof task.createdAt === "object" &&
                task.createdAt.toDate
              ) {
                taskDate = task.createdAt.toDate();
              } else {
                taskDate = new Date(task.createdAt);
              }

              if (isNaN(taskDate.getTime())) return false;
              const taskDateStr = taskDate.toISOString().split("T")[0];
              return taskDateStr === dayStr;
            });
            weekTasks.push(...dayTasks);
          } catch (error) {
            logger.warn("Error processing day:", error, day);
          }
        });
        filteredTasks = weekTasks;
      }

      // Apply user and reporter filtering if specified using shared utility
      if (data.selectedUserId || data.selectedReporterId) {
        filteredTasks = filterTasksByUserAndReporter(filteredTasks, {
          selectedUserId: data.selectedUserId,
          selectedReporterId: data.selectedReporterId,
          currentMonthId: null, // Already filtered by month above
          isUserAdmin: data.isUserAdmin || data.currentUser?.role === "admin",
          currentUserUID: data.currentUser?.userUID,
        });
      }

      // Use pre-calculated values from hooks if available
      const totalTasks = data.actionsTotalTasks ?? filteredTasks.length;
      const totalHours = data.actionsTotalHours ?? 0;
      const totalDeliverables = data.actionsTotalDeliverables ?? 0;
      const totalDeliverablesWithVariationsHours = data.actionsTotalDeliverablesWithVariationsHours ?? 0;

      return [
        {
          icon: Icons.generic.clock,
          label: "Total Hours Task",
          value: `${totalHours.toFixed(1)}h`,
        },
        {
          icon: Icons.generic.deliverable,
          label: "Total Deliverables",
          value: totalDeliverables.toString(),
        },
        {
          icon: Icons.generic.timer,
          label: "Total Hrs Deliverable + Variation",
          value: `${totalDeliverablesWithVariationsHours.toFixed(1)}h`,
        },
      ];
    },
  },

  // Analytics card configurations
  [SMALL_CARD_TYPES.ANALYTICS_TASK_OVERVIEW]: {
    title: "Task Overview",
    subtitle: (data) => data.userName || data.reporterName || "Total Tasks",
    description: "Total Tasks",
    icon: Icons.generic.task,
    color: "blue",
    getValue: (data) => data.totalTasksThisMonth?.toString() || "0",
    getStatus: (data) => `${data.totalHours || 0}h`,
    getBadge: (data) => ({
      text: `${data.totalHours || 0}h`,
      color: "blue",
    }),
    getDetails: (data) => {
      const totalHours = data.totalHours || 0;

      const details = [];

      // Only show hours if there are any
      if (totalHours > 0) {
        details.push({
          icon: Icons.generic.clock,
          label: "Total Hours This Month",
          value: `${totalHours.toFixed(1)}h`,
        });
      }

      return details;
    },
  },

  [SMALL_CARD_TYPES.ANALYTICS_DELIVERABLES]: {
    title: "Deliverables",
    subtitle: "NB Stats",
    description: "deliverables",
    icon: Icons.generic.deliverable,
    color: "orange",
    getValue: (data) => (data.totalDeliverables || 0).toString(),
    getStatus: (data) => `${data.totalVariations || 0} variations`,
    getBadge: (data) => ({
      text: `${data.totalVariations || 0} var`,
      color: "orange",
    }),
    getDetails: (data) => {
      const totalDeliverables = data.totalDeliverables || 0;
      const totalVariations = data.totalVariations || 0;
      const baseHours = data.totalDeliverablesHours || 0;
      const totalHours = data.totalDeliverablesWithVariationsHours || 0;
      const variationsHours = totalHours - baseHours;

      // If no deliverables, return empty array
      if (totalDeliverables === 0) {
        return [];
      }

      const details = [
        {
          icon: Icons.generic.package,
          label: "Total Deliverables",
          value: totalDeliverables.toString(),
        },
      ];

      // Only show variations if there are any
      if (totalVariations > 0) {
        details.push({
          icon: Icons.generic.warning,
          label: "Total Variations",
          value: totalVariations.toString(),
        });
      }

      // Only show hours if there are any
      if (baseHours > 0 || totalHours > 0) {
        if (baseHours > 0) {
          details.push({
            icon: Icons.generic.clock,
            label: "Base Hours (Deliverables Only)",
            value: `${baseHours.toFixed(1)}h`,
          });
        }

        if (variationsHours > 0) {
          details.push({
            icon: Icons.generic.warning,
            label: "Variations Hours",
            value: `${variationsHours.toFixed(1)}h`,
          });
        }

        if (totalHours > 0) {
          details.push({
            icon: Icons.generic.timer,
            label: "Total Hours (Deliverables + Variations)",
            value: `${totalHours.toFixed(1)}h`,
          });
        }
      }

      return details;
    },
  },

  [SMALL_CARD_TYPES.ANALYTICS_MARKETING]: {
    title: "Marketing",
    subtitle: "Marketing Tasks",
    description: "CRM Tasks",
    icon: Icons.generic.target,
    color: "purple",
    getValue: (data) => (data.marketingData?.totalTasks || 0).toString(),
    getStatus: (data) => `${data.marketingData?.totalHours || 0}h`,
    getBadge: (data) => ({
      text: `${data.marketingData?.totalHours || 0}h`,
      color: "purple",
    }),
    getDetails: (data) => {
      const marketingData = data.marketingData || {};
      const details = [];

      // Add each marketing subcategory
      Object.entries(marketingData).forEach(([subcategory, info]) => {
        if (subcategory !== "totalTasks" && subcategory !== "totalHours") {
          details.push({
            icon: Icons.generic.task,
            label: subcategory,
            value: `${info.tasks} tasks`,
            badges:
              info.markets && Object.keys(info.markets).length > 0
                ? info.markets
                : null,
          });
        }
      });

      return details;
    },
  },

  [SMALL_CARD_TYPES.ANALYTICS_ACQUISITION]: {
    title: "Acquisition",
    subtitle: "Acquisition Tasks",
    description: "ACQ Tasks ",
    icon: Icons.generic.users,
    color: "yellow",
    getValue: (data) => (data.acquisitionData?.totalTasks || 0).toString(),
    getStatus: (data) => `${data.acquisitionData?.totalHours || 0}h`,
    getBadge: (data) => ({
      text: `${data.acquisitionData?.totalHours || 0}h`,
      color: "yellow",
    }),
    getDetails: (data) => {
      const acquisitionData = data.acquisitionData || {};
      const details = [];

      // Add each acquisition subcategory
      Object.entries(acquisitionData).forEach(([subcategory, info]) => {
        if (subcategory !== "totalTasks" && subcategory !== "totalHours") {
          details.push({
            icon: Icons.generic.task,
            label: subcategory,
            value: `${info.tasks} tasks`,
            badges:
              info.markets && Object.keys(info.markets).length > 0
                ? info.markets
                : null,
          });
        }
      });

      return details;
    },
  },

  [SMALL_CARD_TYPES.ANALYTICS_PRODUCT]: {
    title: "Product",
    subtitle: "Product Tasks",
    description: "Product Analysis",
    icon: Icons.generic.package,
    color: "orange",
    getValue: (data) => (data.productData?.totalTasks || 0).toString(),
    getStatus: (data) => `${data.productData?.totalHours || 0}h`,
    getBadge: (data) => ({
      text: `${data.productData?.totalHours || 0}h`,
      color: "orange",
    }),
    getDetails: (data) => {
      const productData = data.productData || {};
      const details = [];

      // Add total hours first
      if (productData.totalHours) {
        details.push({
          icon: Icons.generic.clock,
          label: "Total Hours",
          value: `${productData.totalHours}h`,
        });
      }

      // Add each product subcategory
      Object.entries(productData).forEach(([subcategory, info]) => {
        if (subcategory !== "totalTasks" && subcategory !== "totalHours") {
          details.push({
            icon: Icons.generic.task,
            label: subcategory,
            value: `${info.tasks} tasks`,
            badges:
              info.markets && Object.keys(info.markets).length > 0
                ? info.markets
                : null,
          });
        }
      });

      return details;
    },
  },

  [SMALL_CARD_TYPES.ANALYTICS_MISC]: {
    title: "Misc",
    subtitle: "Miscellaneous Tasks",
    description: "Misc Analysis",
    icon: Icons.generic.document,
    color: "gray",
    getValue: (data) => (data.miscData?.totalTasks || 0).toString(),
    getStatus: (data) => `${data.miscData?.totalHours || 0}h`,
    getBadge: (data) => ({
      text: `${data.miscData?.totalHours || 0}h`,
      color: "gray",
    }),
    getDetails: (data) => {
      const miscData = data.miscData || {};
      const details = [];

      // Add total hours first
      if (miscData.totalHours) {
        details.push({
          icon: Icons.generic.clock,
          label: "Total Hours",
          value: `${miscData.totalHours}h`,
        });
      }

      // Add each misc subcategory
      Object.entries(miscData).forEach(([subcategory, info]) => {
        if (subcategory !== "totalTasks" && subcategory !== "totalHours") {
          details.push({
            icon: Icons.generic.task,
            label: subcategory,
            value: `${info.tasks} tasks`,
            badges:
              info.markets && Object.keys(info.markets).length > 0
                ? info.markets
                : null,
          });
        }
      });

      return details;
    },
  },

  [SMALL_CARD_TYPES.ANALYTICS_EFFICIENCY]: {
    title: "Performance",
    subtitle: "Quality Metrics",
    description: "Performance",
    icon: Icons.generic.chart,
    color: "crimson",
    getValue: (data) => "In Progress",
    getStatus: (data) => `${data.efficiency?.productivityScore || 0}%`,
    getBadge: (data) => ({
      text: `${data.efficiency?.productivityScore || 0}%`,
      color: "crimson",
    }),
    getDetails: (data) => [
      {
        icon: Icons.generic.target,
        label: "Productivity Score",
        value: `${data.efficiency?.productivityScore || 0}%`,
      },
      {
        icon: Icons.generic.clock,
        label: "Avg Task Completion",
        value: `${data.efficiency?.averageTaskCompletion || 0} days`,
      },
      {
        icon: Icons.generic.star,
        label: "Quality Rating",
        value: `${data.efficiency?.qualityRating || 0}/5`,
      },
      {
        icon: Icons.generic.check,
        label: "On-Time Delivery",
        value: `${data.efficiency?.onTimeDelivery || 0}%`,
      },
    ],
  },

};

export const createCards = (data, mode = "main") => {
  let cardTypes = [];
  // Allow passing a custom list of types as the second argument
  if (Array.isArray(mode)) {
    cardTypes = mode;
  } else {
    switch (mode) {
      case "main":
        cardTypes = [
          SMALL_CARD_TYPES.MONTH_SELECTION,
          SMALL_CARD_TYPES.ACTIONS,
          SMALL_CARD_TYPES.WEEK_SELECTOR,
          ...(data.isUserAdmin
            ? [SMALL_CARD_TYPES.USER_FILTER, SMALL_CARD_TYPES.REPORTER_FILTER]
            : [SMALL_CARD_TYPES.REPORTER_FILTER]),
          SMALL_CARD_TYPES.USER_PROFILE,
          // Performance card only for user role (not admin)
          ...(data.isUserAdmin ? [] : [SMALL_CARD_TYPES.ANALYTICS_EFFICIENCY]),
        ];
        break;
      case "analytics":
        cardTypes = [
          SMALL_CARD_TYPES.ANALYTICS_TASK_OVERVIEW,
          SMALL_CARD_TYPES.ANALYTICS_DELIVERABLES,
          SMALL_CARD_TYPES.ANALYTICS_MARKETING,
          SMALL_CARD_TYPES.ANALYTICS_ACQUISITION,
          SMALL_CARD_TYPES.ANALYTICS_PRODUCT,
          SMALL_CARD_TYPES.ANALYTICS_MISC,
        ];
        break;
      default:
        cardTypes = [];
    }
  }
  return cardTypes
    .map((cardType) => {
      const config = SMALL_CARD_CONFIGS[cardType];
      if (!config) {
        return null;
      }
      try {
        const card = {
          id: `${cardType}-card`,
          title:
            typeof config.title === "function"
              ? config.title(data)
              : config.title,
          subtitle:
            typeof config.subtitle === "function"
              ? config.subtitle(data)
              : config.subtitle,
          description:
            typeof config.description === "function"
              ? config.description(data)
              : config.description,
          icon: config.icon,
          color:
            typeof config.color === "function"
              ? config.color(data)
              : config.color,
          value: config.getValue(data),
          status: config.getStatus(data),
          badge: config.getBadge ? config.getBadge(data) : null,
          content: config.getContent ? config.getContent(data) : null,
          details: config.getDetails ? config.getDetails(data) : [],
        };

        return card;
      } catch (error) {
        return null;
      }
    })
    .filter((card) => card !== null);
};
