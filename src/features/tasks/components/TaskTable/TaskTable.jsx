import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDataContext } from "@/context/AppDataContext";
import { useAuth } from "@/context/AuthContext";
import TanStackTable from "@/components/Table/TanStackTable";
import { useTaskColumns } from "@/components/Table/tableColumns.jsx";
import { useTableActions } from "@/hooks/useTableActions";
import ConfirmationModal from "@/components/ui/Modal/ConfirmationModal";
import TaskFormModal from "@/features/tasks/components/TaskForm/TaskFormModal";
import { useDeleteTask } from "@/features/tasks/tasksApi";
import { showError, showAuthError, showSuccess } from "@/utils/toast";
import SearchableSelectField from "@/components/forms/components/SearchableSelectField";
import DepartmentFilter from "@/components/filters/DepartmentFilter";
import { TABLE_SYSTEM } from "@/constants";
import { logger } from "@/utils/logger";
import { updateURLParam, updateURLParams, getURLParam } from "@/utils/urlParams";
import { matchesUser, getTaskReporterId, getTaskData, filterTasksByUserAndReporter } from "@/utils/taskFilters";
import { saveUserPreference, loadUserPreference } from "@/utils/userPreferences";

// Available filter options
const FILTER_OPTIONS = [
  { value: "aiUsed", label: "AI Used" },
  { value: "marketing", label: "Marketing" },
  { value: "acquisition", label: "Acquisition" },
  { value: "product", label: "Product" },
  { value: "vip", label: "VIP" },
  { value: "reworked", label: "Reworked" },
  { value: "shutterstock", label: "Shutterstock" },
];

// import './TaskTable.css';

const TaskTable = ({
  className = "",
  selectedUserId = "",
  selectedReporterId = "",
  selectedMonthId = null,
  selectedWeek = null,
  error: tasksError = null,
  isLoading: initialLoading = false,
  onCountChange = null,
  enablePagination = true,
  pageSize = 5, // Default to 5 rows for task table (other tables use TABLE_SYSTEM.DEFAULT_PAGE_SIZE)
}) => {
  // Get navigate function for React Router navigation
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filter values from URL parameters using shared utility
  const urlFilter = getURLParam(searchParams, "filter");
  const urlDepartment = getURLParam(searchParams, "department");
  const urlDeliverable = getURLParam(searchParams, "deliverable");
  const urlSearch = getURLParam(searchParams, "search");

  // Filter state - single selection only - initialize from URL
  const [selectedFilter, setSelectedFilter] = useState(urlFilter || null);
  // Department filter state - initialize from URL
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] =
    useState(urlDepartment || null);
  // Deliverable filter state - initialize from URL
  const [selectedDeliverableFilter, setSelectedDeliverableFilter] =
    useState(urlDeliverable || null);
  // Global search filter state - initialize from URL
  const [globalSearchFilter, setGlobalSearchFilter] = useState(urlSearch || "");

  // Modal states - using table actions system instead

  // Page size state for TanStack pagination
  const [pageSizeState, setPageSizeState] = useState(pageSize);

  // Table ref for clearing selection
  const tableRef = useRef(null);

  // Get auth functions separately
  const { canAccess, user, canDeleteTask, canUpdateTask, canViewTasks } =
    useAuth();
  const isUserAdmin = canAccess("admin");
  const userCanDeleteTasks = canDeleteTask();
  const userCanUpdateTasks = canUpdateTask();
  const userCanViewTasks = canViewTasks();

  // Get data from useAppData hook
  const {
    tasks: contextTasks,
    reporters,
    deliverables,
    user: userData,
    users,
  } = useAppDataContext();

  // Use context tasks with TanStack pagination
  const tasks = contextTasks || [];
  const isLoading = initialLoading;
  const error = tasksError;

  // Get delete task hook
  const [deleteTask] = useDeleteTask();

  // Delete wrapper - simplified since useTableActions now handles permission errors
  const handleTaskDeleteMutation = async (task) => {
    if (!deleteTask) {
      throw new Error("Delete task mutation not available");
    }

    try {
      await deleteTask(
        task.monthId, // Always use task's own monthId
        task.id,
        userData || {} // Pass user data for permission validation
      );
      // Note: Success toast is already shown by useTableActions hook
    } catch (error) {
      showError(`Failed to delete task: ${error.message}`);
      throw error; // Re-throw to maintain error handling in bulk operations
    }
  };

  // Use table actions hook
  const {
    showEditModal: showTableEditModal,
    editingItem,
    showDeleteConfirm,
    itemToDelete,
    rowActionId,
    handleSelect,
    handleEdit,
    handleDelete,
    confirmDelete,
    closeEditModal,
    closeDeleteModal,
    handleEditSuccess,
  } = useTableActions("task", {
    getItemDisplayName: (task) => {
      if (task?.data_task?.taskName) return task.data_task.taskName;
      if (task?.data_task?.departments) {
        const departments = task.data_task.departments;
        return Array.isArray(departments)
          ? departments.join(", ")
          : departments;
      }
      return task?.data_task?.taskName || task?.id;
    },
    deleteMutation: handleTaskDeleteMutation,
    onDeleteSuccess: () => {
      // Clear table selection after delete
      tableRef.current?.clearSelection();
    },
    onSelectSuccess: () => {
      // Don't clear selection immediately for view action - let navigation handle it
      // The selection will be cleared when the component unmounts or when user returns
    },
  });

  // Edit handling is now managed by useTableActions hook

  // Get task columns for the table
  const taskColumns = useTaskColumns(
    selectedMonthId,
    reporters,
    user,
    deliverables
  );

  // Page size change handler for TanStack pagination
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSizeState(newPageSize);
  }, []);

  // Extract stable user values
  const userUID = user?.userUID;

  // Reusable filtering function with role-based access control
  // All filters work together with AND logic - a task must pass ALL active filters to be shown
  // Filter order: 1) User/Reporter/Month, 2) Department, 3) Deliverable, 4) Task Filter, 5) Week
  const getFilteredTasks = useCallback(
    (
      tasks,
      selectedUserId,
      selectedReporterId,
      currentMonthId,
      selectedWeek,
      selectedFilter,
      selectedDepartmentFilter,
      selectedDeliverableFilter
    ) => {
      if (!tasks || !Array.isArray(tasks)) {
        return [];
      }

      // Normalize empty strings to null for proper filtering
      const normalizedUserId = selectedUserId && selectedUserId.trim() !== "" ? selectedUserId : null;
      const normalizedReporterId = selectedReporterId && selectedReporterId.trim() !== "" ? selectedReporterId : null;

      // Step 1: Filter by User, Reporter, and Month (using shared utility)
      let filteredTasks = filterTasksByUserAndReporter(tasks, {
        selectedUserId: normalizedUserId,
        selectedReporterId: normalizedReporterId,
        currentMonthId,
        isUserAdmin,
        currentUserUID: userUID,
      });

      if (import.meta.env.MODE === "development") {
        logger.log("Filtering tasks:", {
          totalTasks: tasks.length,
          afterUserReporterFilter: filteredTasks.length,
          normalizedUserId,
          normalizedReporterId,
          currentMonthId,
          selectedWeek: selectedWeek ? `Week ${selectedWeek.weekNumber}` : null,
          selectedFilter,
          selectedDepartmentFilter,
          selectedDeliverableFilter,
        });
      }

      // Step 2: Apply department filter
      if (selectedDepartmentFilter) {
        if (import.meta.env.MODE === "development") {
          logger.log("Applying department filter:", selectedDepartmentFilter);
        }
        filteredTasks = filteredTasks.filter((task) => {
          const taskData = getTaskData(task);
          const taskDepartments = taskData.departments;

          // Normalize the selected filter to lowercase for comparison
          const normalizedFilter = selectedDepartmentFilter.toLowerCase();

          // Handle both array and string formats
          if (Array.isArray(taskDepartments)) {
            return taskDepartments.some(
              (dept) => dept?.toLowerCase() === normalizedFilter
            );
          } else if (typeof taskDepartments === "string") {
            return taskDepartments.toLowerCase() === normalizedFilter;
          }
          return false;
        });
      }

      // Step 3: Apply deliverable filter
      if (selectedDeliverableFilter) {
        if (import.meta.env.MODE === "development") {
          logger.log("Applying deliverable filter:", selectedDeliverableFilter);
        }
        filteredTasks = filteredTasks.filter((task) => {
          const taskData = getTaskData(task);
          const deliverablesUsed = taskData.deliverablesUsed;

          if (
            !deliverablesUsed ||
            !Array.isArray(deliverablesUsed) ||
            deliverablesUsed.length === 0
          ) {
            return false;
          }

          // Check if any deliverable matches the selected filter
          return deliverablesUsed.some((deliverable) => {
            const deliverableName = deliverable?.name;
            return (
              deliverableName &&
              deliverableName.toLowerCase() ===
                selectedDeliverableFilter.toLowerCase()
            );
          });
        });
      }

      // Step 4: Apply task filter (AI Used, Marketing, Acquisition, Product, VIP, Reworked, Shutterstock)
      if (selectedFilter) {
        if (import.meta.env.MODE === "development") {
          logger.log("Applying filter:", selectedFilter);
        }
        filteredTasks = filteredTasks.filter((task) => {
          const taskData = getTaskData(task);

          // Apply the selected filter
          switch (selectedFilter) {
            case "aiUsed":
              return taskData.aiUsed?.length > 0;
            case "marketing":
              return taskData.products?.includes("marketing");
            case "acquisition":
              return taskData.products?.includes("acquisition");
            case "product":
              return taskData.products?.includes("product");
            case "vip":
              return taskData.isVip;
            case "reworked":
              return taskData.reworked;
            case "shutterstock":
              return taskData.useShutterstock === true;
            default:
              return true;
          }
        });
      }

      // Step 5: Apply week filter (if week is selected, filter by task startDate)
      if (selectedWeek) {
        if (import.meta.env.MODE === "development") {
          logger.log("Applying week filter:", {
            weekNumber: selectedWeek.weekNumber,
            startDate: selectedWeek.startDate,
            endDate: selectedWeek.endDate,
            days: selectedWeek.days?.length || 0,
            tasksBeforeWeekFilter: filteredTasks.length,
          });
        }
        
        // Get week date range - use startDate and endDate if available, otherwise calculate from days
        let weekStart, weekEnd;
        
        if (selectedWeek.startDate && selectedWeek.endDate) {
          weekStart = new Date(selectedWeek.startDate);
          weekEnd = new Date(selectedWeek.endDate);
        } else if (selectedWeek.days && Array.isArray(selectedWeek.days) && selectedWeek.days.length > 0) {
          // Calculate from days array if dates not available
          const sortedDays = [...selectedWeek.days]
            .map(day => day instanceof Date ? day : new Date(day))
            .filter(day => !isNaN(day.getTime()))
            .sort((a, b) => a - b);
          
          if (sortedDays.length > 0) {
            weekStart = new Date(sortedDays[0]);
            weekEnd = new Date(sortedDays[sortedDays.length - 1]);
          } else {
            // If no valid days, skip week filter
            if (import.meta.env.MODE === "development") {
              logger.warn("Week has no valid days, skipping week filter");
            }
            weekStart = null;
            weekEnd = null;
          }
        } else {
          // If no date info available, skip week filter
          if (import.meta.env.MODE === "development") {
            logger.warn("Week has no date information, skipping week filter");
          }
          weekStart = null;
          weekEnd = null;
        }

        if (weekStart && weekEnd) {
          // Normalize week dates to start/end of day for comparison
          weekStart.setHours(0, 0, 0, 0);
          weekEnd.setHours(23, 59, 59, 999);

          filteredTasks = filteredTasks.filter((task) => {
            const taskData = getTaskData(task);
            
            // Use createdAt to determine which week the task belongs to
            // If task has no createdAt, exclude it when week filter is active
            if (!task.createdAt) {
              if (import.meta.env.MODE === "development") {
                logger.log("Task excluded - no createdAt:", {
                  taskId: task.id || task.taskId,
                  taskName: taskData.taskName,
                });
              }
              return false;
            }

            try {
              // Parse task createdAt date - handle multiple formats (ISO string, Date, string)
              let taskCreatedDate;
              if (task.createdAt instanceof Date) {
                taskCreatedDate = new Date(task.createdAt);
              } else if (typeof task.createdAt === "string") {
                taskCreatedDate = new Date(task.createdAt);
              } else if (
                task.createdAt &&
                typeof task.createdAt === "object" &&
                task.createdAt.seconds
              ) {
                taskCreatedDate = new Date(task.createdAt.seconds * 1000);
              } else if (
                task.createdAt &&
                typeof task.createdAt === "object" &&
                task.createdAt.toDate &&
                typeof task.createdAt.toDate === "function"
              ) {
                taskCreatedDate = task.createdAt.toDate();
              } else {
                taskCreatedDate = new Date(task.createdAt);
              }

              if (isNaN(taskCreatedDate.getTime())) {
                if (import.meta.env.MODE === "development") {
                  logger.warn("Task excluded - invalid createdAt:", {
                    taskId: task.id || task.taskId,
                    createdAt: task.createdAt,
                  });
                }
                return false;
              }

              // Normalize task date to start of day for comparison
              taskCreatedDate.setHours(0, 0, 0, 0);

              // Check if task createdAt falls within the week range
              // Task belongs to this week if its createdAt is within weekStart and weekEnd
              const isInWeek = taskCreatedDate >= weekStart && taskCreatedDate <= weekEnd;

              if (import.meta.env.MODE === "development") {
                if (isInWeek) {
                  logger.log("Task matches week:", {
                    taskId: task.id || task.taskId,
                    taskName: taskData.taskName,
                    taskCreatedDate: taskCreatedDate.toISOString().split("T")[0],
                    weekStart: weekStart.toISOString().split("T")[0],
                    weekEnd: weekEnd.toISOString().split("T")[0],
                  });
                }
              }

              return isInWeek;
            } catch (error) {
              logger.warn("Error processing task date for week filter:", error, {
                taskId: task.id || task.taskId,
                createdAt: task.createdAt,
              });
              return false;
            }
          });

          if (import.meta.env.MODE === "development") {
            logger.log("After week filter:", {
              tasksAfterWeekFilter: filteredTasks.length,
            });
          }
        }
      }

      return filteredTasks;
    },
    [isUserAdmin, userUID, matchesUser, getTaskData, getTaskReporterId]
  );

  // Get filtered tasks and sort by createdAt (newest first) - memoized for performance
  const filteredTasks = useMemo(() => {
    if (!tasks || !Array.isArray(tasks)) {
      return [];
    }
    
    // First, deduplicate tasks by ID to ensure uniqueness
    const uniqueTasksMap = new Map();
    tasks.forEach(task => {
      if (task && task.id) {
        if (!uniqueTasksMap.has(task.id)) {
          uniqueTasksMap.set(task.id, task);
        }
      }
    });
    const uniqueTasks = Array.from(uniqueTasksMap.values());
    
    const filtered = getFilteredTasks(
      uniqueTasks,
      selectedUserId,
      selectedReporterId,
      selectedMonthId,
      selectedWeek,
      selectedFilter,
      selectedDepartmentFilter,
      selectedDeliverableFilter
    );

    // Sort by createdAt in descending order (newest first)
    return filtered.sort((a, b) => {
      // Handle ISO timestamps and different date formats
      let dateA, dateB;

      if (a.createdAt) {
        // Handle timestamp objects (backward compatibility)
        if (a.createdAt.seconds) {
          dateA = new Date(a.createdAt.seconds * 1000);
        } else if (a.createdAt.toDate) {
          dateA = a.createdAt.toDate();
        } else {
          dateA = new Date(a.createdAt);
        }
      } else {
        dateA = new Date(0);
      }

      if (b.createdAt) {
        // Handle timestamp objects (backward compatibility)
        if (b.createdAt.seconds) {
          dateB = new Date(b.createdAt.seconds * 1000);
        } else if (b.createdAt.toDate) {
          dateB = b.createdAt.toDate();
        } else {
          dateB = new Date(b.createdAt);
        }
      } else {
        dateB = new Date(0);
      }

      return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
    });
  }, [
    tasks,
    selectedUserId,
    selectedReporterId,
    selectedMonthId,
    selectedWeek,
    selectedFilter,
    selectedDepartmentFilter,
    selectedDeliverableFilter,
    getFilteredTasks,
  ]);

  // Bulk actions - build array efficiently without re-creation
  const bulkActions = useMemo(() => {
    const actions = [];

    // Always add Jira link action first
    actions.push({
      label: "View Jira Link",
      icon: "code",
      variant: "secondary",
      onClick: (selectedTasks) => {
        if (selectedTasks.length === 1) {
          const task = selectedTasks[0];
          const taskName = task.data_task?.taskName;

          if (taskName) {
            const fullJiraUrl = `https://gmrd.atlassian.net/browse/${taskName}`;
            window.open(fullJiraUrl, "_blank", "noopener,noreferrer");
          } else {
            showError("No Jira ticket or URL available for this task");
          }
        } else {
          showError("Please select only ONE task to view Jira link");
        }
      },
    });

    // Add view action if user has permission
    if (userCanViewTasks) {
      actions.push({
        label: "View Selected",
        icon: "eye",
        variant: "secondary",
        onClick: (selectedTasks) => {
          if (selectedTasks.length === 1) {
            const task = selectedTasks[0];
            const params = new URLSearchParams();
            if (task.monthId) params.set("monthId", task.monthId);
            if (task.createdByName) params.set("user", task.createdByName);
            navigate(`/task/${task.id}?${params.toString()}`);
          } else {
            showError("Please select only ONE task to view");
          }
        },
      });
    }

    // Add edit action if user has permission
    if (userCanUpdateTasks) {
      actions.push({
        label: "Edit Selected",
        icon: "edit",
        variant: "primary",
        onClick: (selectedTasks) => {
          if (selectedTasks.length === 1) {
            handleEdit(selectedTasks[0]);
          } else {
            showError("Please select only ONE task to edit");
          }
        },
      });
    }

    // Add delete action if user has permission
    if (userCanDeleteTasks) {
      actions.push({
        label: "Delete Selected",
        icon: "delete",
        variant: "crimson",
        onClick: async (selectedTasks) => {
          if (selectedTasks.length === 1) {
            handleDelete(selectedTasks[0]);
          } else {
            showError("Please select only ONE task to delete");
          }
        },
      });
    }

    return actions;
  }, [
    userCanViewTasks,
    userCanUpdateTasks,
    userCanDeleteTasks,
    navigate,
    handleEdit,
    handleDelete,
  ]);

  // Default column visibility
  const defaultColumnVisibility = {
    isVip: false, // Hide VIP column by default
    reworked: true, // Show Reworked column by default
    startDate: true, // Show Start Date column by default
    endDate: true, // Show End Date column by default
    observations: false, // Hide Observations column by default
  };

  // Load saved column visibility from localStorage (per user)
  // Note: userUID is already declared above (line 175)
  const [columnVisibility, setColumnVisibility] = useState(() => {
    if (userUID) {
      const saved = loadUserPreference(userUID, 'taskTable_columnVisibility', defaultColumnVisibility);
      return { ...defaultColumnVisibility, ...saved };
    }
    return defaultColumnVisibility;
  });

  // Handle column visibility changes - save to localStorage
  const handleColumnVisibilityChange = useCallback((newVisibility) => {
    setColumnVisibility(newVisibility);
    if (userUID) {
      saveUserPreference(userUID, 'taskTable_columnVisibility', newVisibility);
    }
  }, [userUID]);

  // Reload column visibility when user changes
  useEffect(() => {
    if (userUID) {
      const saved = loadUserPreference(userUID, 'taskTable_columnVisibility', defaultColumnVisibility);
      setColumnVisibility({ ...defaultColumnVisibility, ...saved });
    } else {
      setColumnVisibility(defaultColumnVisibility);
    }
  }, [userUID]); // Only depend on userUID, not defaultColumnVisibility

  // Use columnVisibility state as initialColumnVisibility for TanStackTable
  const initialColumnVisibility = columnVisibility;

  // Notify parent component about count changes
  useEffect(() => {
    if (onCountChange) {
      onCountChange(filteredTasks?.length || 0);
    }
  }, [filteredTasks?.length, onCountChange]);

  // Sync filter states with URL parameters when URL changes (but not when we're updating URL from state)
  const isUpdatingURLRef = useRef(false);
  
  useEffect(() => {
    // Skip if we're in the middle of updating URL
    if (isUpdatingURLRef.current) {
      isUpdatingURLRef.current = false;
      return;
    }

    const urlFilter = searchParams.get("filter") || "";
    const urlDepartment = searchParams.get("department") || "";
    const urlDeliverable = searchParams.get("deliverable") || "";
    const urlSearch = searchParams.get("search") || "";

    // Only update state if URL params differ from current state
    if (urlFilter !== (selectedFilter || "")) {
      setSelectedFilter(urlFilter || null);
    }
    if (urlDepartment !== (selectedDepartmentFilter || "")) {
      setSelectedDepartmentFilter(urlDepartment || null);
    }
    if (urlDeliverable !== (selectedDeliverableFilter || "")) {
      setSelectedDeliverableFilter(urlDeliverable || null);
    }
    if (urlSearch !== globalSearchFilter) {
      setGlobalSearchFilter(urlSearch);
    }
  }, [searchParams]);

  // Sync global search filter with URL
  useEffect(() => {
    const urlSearch = getURLParam(searchParams, "search");
    // Only update URL if the filter value differs from URL
    if (globalSearchFilter !== urlSearch) {
      isUpdatingURLRef.current = true;
      updateURLParam(setSearchParams, "search", globalSearchFilter || "");
    }
  }, [globalSearchFilter, searchParams, setSearchParams]);


  // Handle filter value change from SearchableSelectField
  const handleFilterValueChange = useCallback(
    (fieldName, value) => {
      if (fieldName === "taskFilter") {
        // If clicking the same filter or clearing, deselect it
        const newValue = (selectedFilter === value || !value) ? null : value;
        setSelectedFilter(newValue);
        updateURLParam(setSearchParams, "filter", newValue || "");
      } else if (fieldName === "departmentFilter") {
        // If clicking the same department filter or clearing, deselect it
        const newValue = (selectedDepartmentFilter === value || !value) ? null : value;
        setSelectedDepartmentFilter(newValue);
        updateURLParam(setSearchParams, "department", newValue || "");
      } else if (fieldName === "deliverableFilter") {
        // If clicking the same deliverable filter or clearing, deselect it
        const newValue = (selectedDeliverableFilter === value || !value) ? null : value;
        setSelectedDeliverableFilter(newValue);
        updateURLParam(setSearchParams, "deliverable", newValue || "");
      }
    },
    [selectedFilter, selectedDepartmentFilter, selectedDeliverableFilter, setSearchParams]
  );

  // Create deliverables options for filter
  const deliverableFilterOptions = useMemo(() => {
    if (
      !deliverables ||
      !Array.isArray(deliverables) ||
      deliverables.length === 0
    ) {
      return [];
    }
    return deliverables.map((deliverable) => ({
      value: deliverable.name,
      label: deliverable.name,
    }));
  }, [deliverables]);

  // Get user's department for filtering (user role only sees their own department)
  const userDepartmentOptions = useMemo(() => {
    if (isUserAdmin) {
      // Admin sees all departments
      return null; // null means use default FORM_OPTIONS.DEPARTMENTS
    }
    
    // For user role, only show their own department
    const userDepartment = userData?.department;
    if (!userDepartment) {
      return null; // If no department, don't show filter
    }
    
    // Return array with only user's department
    return [{ value: userDepartment, label: userDepartment }];
  }, [isUserAdmin, userData?.department]);

  // Department filter component (to show after search)
  // Show for admins (userDepartmentOptions === null means use default) or for users with department
  const departmentFilterComponent = (
    <DepartmentFilter
      selectedDepartmentFilter={selectedDepartmentFilter}
      onFilterChange={handleFilterValueChange}
      departmentOptions={userDepartmentOptions}
    />
  );

  // Create filter component for inline display (task filters and deliverables only, department is separate)
  const taskFilterComponent = (
    <div className="flex items-center space-x-4">
      <SearchableSelectField
        field={{
          name: "taskFilter",
          type: "select",
          label: "Task Filters",
          required: false,
          options: FILTER_OPTIONS,
          placeholder: "Search filters ",
        }}
        register={() => {}}
        errors={{}}
        setValue={handleFilterValueChange}
        watch={() => selectedFilter || ""}
        trigger={() => {}}
        clearErrors={() => {}}
        formValues={{}}
        noOptionsMessage="No filters found"
      />
      <SearchableSelectField
        field={{
          name: "deliverableFilter",
          type: "select",
          label: "Deliverable",
          required: false,
          options: deliverableFilterOptions,
          placeholder: "Search deliverable ",
        }}
        register={() => {}}
        errors={{}}
        setValue={handleFilterValueChange}
        watch={() => selectedDeliverableFilter || ""}
        trigger={() => {}}
        clearErrors={() => {}}
        formValues={{}}
        noOptionsMessage="No deliverables found"
      />
    </div>
  );

  return (
    <div className={`task-table  ${className}`}>
      {/* Table */}
      <TanStackTable
        ref={tableRef}
        data={filteredTasks}
        columns={taskColumns}
        tableType="tasks"
        error={error}
        isLoading={isLoading}
        onSelect={handleSelect}
        onEdit={userCanUpdateTasks ? handleEdit : null}
        onDelete={userCanDeleteTasks ? handleDelete : null}
        enableRowSelection={true}
        showBulkActions={true}
        bulkActions={bulkActions}
        initialColumnVisibility={initialColumnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        reporters={reporters}
        users={users}
        deliverables={deliverables}
        // TanStack pagination configuration
        enablePagination={enablePagination}
        showPagination={enablePagination}
        pageSize={pageSizeState}
        // Custom filter component
        customFilter={taskFilterComponent}
        // Department filter (shown after search)
        departmentFilter={departmentFilterComponent}
        // Global filter props for URL sync
        initialGlobalFilter={globalSearchFilter}
        onGlobalFilterChange={setGlobalSearchFilter}
        // Pass filter state for dynamic export
        customFilters={{
          selectedFilter,
          selectedDepartmentFilter,
          selectedDeliverableFilter,
          selectedUserId,
          selectedReporterId,
          selectedWeek,
        }}
      />

      {/* Edit Task Modal - managed by useTableActions */}
      {showTableEditModal && editingItem && (
        <TaskFormModal
          isOpen={showTableEditModal}
          onClose={closeEditModal}
          mode="edit"
          task={editingItem}
          monthId={selectedMonthId}
          onSuccess={handleEditSuccess}
          onError={(error) => {
            // Handle permission errors
            if (
              error?.message?.includes("permission") ||
              error?.message?.includes("User lacks required")
            ) {
              showAuthError("You do not have permission to edit tasks");
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Task"
        message={`Are you sure you want to delete task "${(() => {
          if (itemToDelete?.data_task?.taskName)
            return itemToDelete.data_task.taskName;
          if (itemToDelete?.data_task?.departments) {
            const departments = itemToDelete.data_task.departments;
            return Array.isArray(departments)
              ? departments.join(", ")
              : departments;
          }
          return itemToDelete?.data_task?.taskName || itemToDelete?.id;
        })()}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={rowActionId === itemToDelete?.id}
      />
    </div>
  );
};

export default TaskTable;
