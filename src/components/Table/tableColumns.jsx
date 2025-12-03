import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import Badge from "@/components/ui/Badge/Badge";
import { formatDate, normalizeTimestamp } from "@/utils/dateUtils";
import {
  useDeliverableCalculation,
  useDeliverablesOptionsFromProps,
} from "@/features/deliverables/DeliverablesManager";
import { TABLE_SYSTEM, CARD_SYSTEM } from "@/constants";
import { differenceInDays } from "date-fns";

const columnHelper = createColumnHelper();
// Constants
const DATE_FORMATS = TABLE_SYSTEM.DATE_FORMATS;
// Utility functions
const formatDateCell = (
  value,
  format = DATE_FORMATS.SHORT,
  showTime = true
) => {
  if (!value) return "-";
  return formatDate(value, format, showTime);
};
const getDurationDays = (startDate, endDate) => {
  if (!startDate || !endDate) return null;

  try {
    // Use date utilities for consistent date handling
    const start = normalizeTimestamp(startDate);
    const end = normalizeTimestamp(endDate);

    // Check if dates are valid
    if (!start || !end) return null;

    // Use date-fns for accurate day calculation
    const diffDays = differenceInDays(end, start);

    // If end is before start, return 0
    if (diffDays < 0) return 0;

    // Return calendar days (including partial days)
    return Math.ceil(diffDays);
  } catch {
    return null;
  }
};
// Common column cell helpers
const createSimpleCell =
  (fallback = "-") =>
  ({ getValue }) =>
    getValue() || fallback;
const createDateCell =
  (format = DATE_FORMATS.SHORT) =>
  ({ getValue }) => {
    const value = getValue();
    if (!value) return "-";
    return (
      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
        {formatDateCell(value, format)}
      </span>
    );
  };

// Optimized DeliverableCalculationCell component
const DeliverableCalculationCell = ({
  deliverablesUsed,
  isUserAdmin,
  deliverables = [],
}) => {
  const { deliverablesOptions = [] } =
    useDeliverablesOptionsFromProps(deliverables);
  const { deliverablesList, totalTime } = useDeliverableCalculation(
    deliverablesUsed,
    deliverablesOptions
  );

  if (!deliverablesList?.length) {
    return (
      <span className="text-gray-500 dark:text-gray-400">No deliverables</span>
    );
  }

  return (
    <div className="space-y-1">
      {deliverablesList.map((deliverable, index) => (
        <div key={index} className="text-xs">
          <div className="font-medium text-gray-800 dark:text-gray-200">
            {deliverable.quantity}x{deliverable.name}
            {(deliverable.variationsQuantity || deliverable.declinariQuantity) > 0 && (
              <span style={{ color: CARD_SYSTEM.COLOR_HEX_MAP.amber }}>
                {" "}+ {deliverable.variationsQuantity || deliverable.declinariQuantity} variations
              </span>
            )}
          </div>
          {/* Show calculation details to all users */}
          <div className="text-xs text-gray-800 dark:text-gray-300 space-y-1">
            {deliverable.configured ? (
              <div className="text-xs block">
                <div className="block">
                  {deliverable.timePerUnit}
                  {deliverable.timeUnit} × {deliverable.quantity}
                  {(deliverable.variationsQuantity || deliverable.declinariQuantity) > 0 &&
                    (Number(deliverable.variationsTimeInMinutes) || 0) > 0 && (
                      <span>
                        {" "}+ {deliverable.variationsQuantity || deliverable.declinariQuantity} × {Number(deliverable.variationsTimeInMinutes || 0).toFixed(0)}min
                      </span>
                    )}
                </div>
                <div
                  className="block font-semibold"
                  style={{ color: CARD_SYSTEM.COLOR_HEX_MAP.amber }}
                >
                  Total: {Number(deliverable.time || 0).toFixed(2)}h ({((Number(deliverable.time || 0) * 60) / 480).toFixed(2)} days)
                </div>
              </div>
            ) : deliverable.notConfigured ? (
              <span style={{ color: CARD_SYSTEM.COLOR_HEX_MAP.amber }}>
                ⚠️ Not configured in settings - Add to Settings → Deliverables
              </span>
            ) : (
              <span className="text-gray-800 dark:text-gray-400">
                No time configuration
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Task column definitions
const createTaskColumns = (isUserAdmin, stableReporters, deliverables = []) => [
  columnHelper.accessor("data_task.taskName", {
    header: "JIRA LINK",
    cell: ({ getValue, row }) => {
      const taskName = getValue() || row.original?.data_task?.taskName;
      if (!taskName)
        return (
          <span className="text-gray-800 dark:text-gray-400">No Link</span>
        );

      return (
        <Badge variant="green" size="md">
          {taskName}
        </Badge>
      );
    },
    size: 120,
  }),
  columnHelper.accessor((row) => row.data_task?.departments, {
    id: "departments",
    header: "DEPARTMENT",
    cell: ({ getValue, row }) => {
      // 1. Handle the 'No data_task' case specifically
      if (!row.original?.data_task) {
        return (
          <span
            className="text-xs"
            style={{ color: CARD_SYSTEM.COLOR_HEX_MAP.pink }}
          >
            ❌ No data_task
          </span>
        );
      }

      const value = getValue();

      // 2. Return the value if it exists (is truthy), or '❌ Missing' if it's falsy (null, undefined, or empty string)
      return (
        value || (
          <span
            className="text-xs"
            style={{ color: CARD_SYSTEM.COLOR_HEX_MAP.pink }}
          >
            ❌ Missing
          </span>
        )
      );
    },
    size: 100,
  }),
  columnHelper.accessor((row) => row.data_task?.products, {
    id: "products",
    header: "PRODUCT",
    cell: createSimpleCell(),
    size: 70,
  }),
  columnHelper.accessor((row) => row.data_task?.markets, {
    id: "markets",
    header: "MARKETS",
    cell: ({ getValue }) => {
      const markets = getValue();
      if (!markets?.length) return "-";

      return (
        <div className="flex flex-wrap gap-1 uppercase">
          {markets.map((market, index) => (
            <Badge key={index} variant="pink" size="md">
              {market}
            </Badge>
          ))}
        </div>
      );
    },
    size: 140,
  }),
  columnHelper.accessor((row) => row.data_task?.aiUsed?.[0]?.aiModels, {
    id: "aiModels",
    header: "AI MODELS",
    cell: ({ getValue, row }) => {
      const aiModels = getValue();
      const aiTime = row.original?.data_task?.aiUsed?.[0]?.aiTime;

      if (!aiModels?.length) return "-";

      return (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {aiModels.map((model, index) => (
              <Badge key={index} variant="pink" size="md">
                {model}
              </Badge>
            ))}
          </div>
          {aiTime > 0 && (
            <div className="text-xs text-gray-800 dark:text-gray-400">
              Total hr: {aiTime}h
            </div>
          )}
        </div>
      );
    },
    size: 80,
  }),
  columnHelper.accessor((row) => row.data_task?.deliverablesUsed, {
    id: "deliverables",
    header: "LIVRABLES",
    cell: ({ getValue, row }) => (
      <DeliverableCalculationCell
        deliverablesUsed={getValue()}
        isUserAdmin={isUserAdmin}
        deliverables={deliverables}
      />
    ),
    size: 220,
  }),
  columnHelper.accessor((row) => row.data_task?.reporters, {
    id: "reporters",
    header: "REPORTERS",
    cell: ({ getValue, row }) => {
      // First try to get reporterName if it exists
      let name = row.original?.data_task?.reporterName;

      // Fallback to resolving reporter ID
      if (!name) {
        const reporterId = getValue();
        if (!reporterId) return "-";

        const reporter = stableReporters.find((r) => {
          const reporterIdField = r.reporterUID;
          return (
            reporterIdField &&
            typeof reporterIdField === "string" &&
            reporterIdField.toLowerCase() === reporterId.toLowerCase()
          );
        });
        name = reporter?.name || reporterId;
      }

      if (!name) return "-";

      // Format name on two lines
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length === 1) {
        return nameParts[0];
      }
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      return (
        <div className="flex flex-col leading-tight">
          <span>{firstName}</span>
          <span>{lastName}</span>
        </div>
      );
    },
    size: 60,
  }),
  columnHelper.accessor("createdByName", {
    header: "CREATED BY",
    cell: ({ getValue }) => {
      const name = getValue();
      if (!name) return "-";

      // Format name on two lines
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length === 1) {
        return nameParts[0];
      }
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      return (
        <div className="flex flex-col leading-tight">
          <span>{firstName}</span>
          <span>{lastName}</span>
        </div>
      );
    },
    size: 80,
  }),
  columnHelper.accessor("createdAt", {
    header: "TASK ADDED",
    cell: createDateCell(DATE_FORMATS.DATETIME_LONG),
    size: 120,
  }),
  columnHelper.accessor((row) => row.data_task?.observations, {
    id: "observations",
    header: "OBSERVATIONS",
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return "-";

      const truncated =
        value.length > 50 ? `${value.substring(0, 50)}...` : value;

      return (
        <span title={value} className="block truncate">
          {truncated}
        </span>
      );
    },
    size: 80,
  }),

  // Additional task data columns (hidden by default)
  columnHelper.accessor((row) => row.data_task?.startDate, {
    id: "startDate",
    header: "TASK START",
    cell: createDateCell(DATE_FORMATS.LONG),
    size: 100,
  }),
  columnHelper.accessor((row) => row.data_task?.endDate, {
    id: "endDate",
    header: "TASK END",
    cell: createDateCell(DATE_FORMATS.LONG),
    size: 80,
  }),
  columnHelper.accessor((row) => row.data_task?.startDate, {
    id: "done",
    header: "DONE BY",
    cell: ({ getValue, row }) => {
      const startDate = getValue();
      const endDate = row.original?.data_task?.endDate;

      const days = getDurationDays(startDate, endDate);

      if (days === 0) {
        return (
          <Badge variant="green" size="md">
            Same day
          </Badge>
        );
      }

      return (
        <Badge variant="pink" size="md">
          {days} days
        </Badge>
      );
    },
    size: 80,
  }),
  columnHelper.accessor((row) => row.data_task?.timeInHours, {
    id: "timeInHours",
    header: "TASK HR",
    cell: ({ getValue }) => {
      const value = getValue();
      if (!value) return "-";

      return (
        <Badge variant="amber" size="md">
          {value}h
        </Badge>
      );
    },
    size: 70,
  }),
  columnHelper.accessor((row) => row.data_task?.isVip, {
    id: "isVip",
    header: "VIP",
    cell: ({ getValue }) => {
      const value = getValue();
      if (value) {
        return (
          <Badge variant="green" size="md">
            Yes
          </Badge>
        );
      }
      return "-";
    },
    size: 40,
  }),
  columnHelper.accessor((row) => row.data_task?.reworked, {
    id: "reworked",
    header: "REWORKED",
    cell: ({ getValue }) => {
      const value = getValue();
      if (value) {
        return (
          <Badge variant="green" size="md">
            Yes
          </Badge>
        );
      }
      return "-";
    },
    size: 60,
  }),
  columnHelper.accessor((row) => row.data_task?.useShutterstock, {
    id: "useShutterstock",
    header: "SHUTTERSTOCK",
    cell: ({ getValue }) => {
      const value = getValue();
      if (value) {
        return (
          <Badge variant="green" size="md">
            Yes
          </Badge>
        );
      }
      return "-";
    },
    size: 50,
  }),
];

// Tasks Table Columns - Memoized to prevent re-renders
export const useTaskColumns = (
  monthId = null,
  reporters = [],
  user = null,
  deliverables = []
) => {
  const stableReporters = Array.isArray(reporters) ? reporters : [];
  const isUserAdmin = user?.role === "admin";

  return useMemo(
    () => createTaskColumns(isUserAdmin, stableReporters, deliverables),
    [monthId, stableReporters, isUserAdmin, deliverables]
  );
};

// User column definitions
const createUserColumns = () => [
  columnHelper.accessor("name", {
    header: "USERS",
    cell: createSimpleCell(),
    size: 200,
  }),
  columnHelper.accessor("email", {
    header: "EMAIL",
    cell: createSimpleCell(),
    size: 200,
  }),
  columnHelper.accessor("role", {
    header: "ROLE",
    cell: ({ getValue }) => {
      const role = getValue() || "user";
      return (
        <Badge variant={role === "admin" ? "pink" : "blue"} size="xs">
          {role}
        </Badge>
      );
    },
    size: 100,
  }),
  columnHelper.accessor("permissions", {
    header: "PERMISSIONS",
    cell: ({ getValue }) => {
      const permissions = getValue();
      if (!Array.isArray(permissions) || !permissions.length) {
        return (
          <span style={{ color: CARD_SYSTEM.COLOR_HEX_MAP.pink }}>
            No permissions
          </span>
        );
      }

      return (
        <div className="flex flex-wrap gap-1">
          {permissions.map((permission, index) => (
            <Badge key={index} variant="green">
              {permission.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      );
    },
    size: 200,
  }),
  columnHelper.accessor("occupation", {
    header: "DEPARTMENT",
    cell: createSimpleCell(),
    size: 150,
  }),
  columnHelper.accessor("createdAt", {
    header: "CREATED",
    cell: createDateCell(DATE_FORMATS.DATETIME_LONG),
    size: 150,
  }),
];

// Reporter column definitions
const createReporterColumns = () => [
  columnHelper.accessor("name", {
    header: "REPORTERS",
    cell: createSimpleCell(),
    size: 200,
  }),
  columnHelper.accessor("email", {
    header: "Email",
    cell: createSimpleCell(),
    size: 200,
  }),
  columnHelper.accessor("departament", {
    header: "DEPARTMENT",
    cell: ({ getValue }) => {
      const department = getValue();
      if (!department)
        return (
          <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>
        );
      return (
        <Badge variant="green" size="md" className="uppercase">
          {department}
        </Badge>
      );
    },
    size: 150,
  }),
  columnHelper.accessor("country", {
    header: "COUNTRY",
    cell: ({ getValue }) => {
      const country = getValue();
      if (!country)
        return (
          <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>
        );
      return (
        <Badge variant="amber" size="md" className="uppercase">
          {country}
        </Badge>
      );
    },
    size: 100,
  }),
  columnHelper.accessor("channelName", {
    header: "CHANNEL",
    cell: ({ getValue }) => {
      const channel = getValue();
      if (!channel)
        return (
          <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>
        );
      return (
        <Badge variant="orange" size="md" className="uppercase">
          {channel}
        </Badge>
      );
    },
    size: 120,
  }),
  columnHelper.accessor("createdAt", {
    header: "CREATED",
    cell: createDateCell(DATE_FORMATS.DATETIME_LONG),
    size: 150,
  }),
];

// Team Days Off column definitions
const createTeamDaysOffColumns = () => [
  columnHelper.accessor('userName', {
    header: 'USER',
    cell: ({ getValue }) => (
      <span className="font-medium text-gray-900 dark:text-white">
        {getValue() || '-'}
      </span>
    ),
    size: 200,
  }),
  columnHelper.accessor('daysTotal', {
    header: 'DAYS TOTAL',
    cell: ({ getValue, row }) => {
      const total = getValue();
      const baseDays = row.original.baseDays || 0;
      const monthlyAccrual = row.original.monthlyAccrual || 0;
      return (
        <div className="flex flex-col">
          <Badge variant="blue" size="md">
            {total.toFixed(2)} days
          </Badge>
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Base: {baseDays} + Monthly: {monthlyAccrual.toFixed(2)}
          </span>
        </div>
      );
    },
    size: 150,
  }),
  columnHelper.accessor('daysOff', {
    header: 'DAYS OFF',
    cell: ({ getValue }) => {
      const daysOff = getValue() || 0;
      return (
        <Badge variant="amber" size="md">
          {daysOff.toFixed(2)} days
        </Badge>
      );
    },
    size: 120,
  }),
  columnHelper.accessor('daysRemaining', {
    header: 'DAYS REMAINING',
    cell: ({ getValue }) => {
      const remaining = getValue() || 0;
      const variant = remaining < 5 ? 'red' : remaining < 10 ? 'amber' : 'green';
      return (
        <Badge variant={variant} size="md">
          {remaining.toFixed(2)} days
        </Badge>
      );
    },
    size: 150,
  }),
  columnHelper.accessor('baseDays', {
    header: 'BASE DAYS',
    cell: ({ getValue }) => {
      const baseDays = getValue() || 0;
      return (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {baseDays.toFixed(2)}
        </span>
      );
    },
    size: 100,
  }),
  columnHelper.accessor('monthlyAccrual', {
    header: 'MONTHLY ACCRUAL',
    cell: ({ getValue }) => {
      const accrual = getValue() || 0;
      return (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {accrual.toFixed(2)} days
        </span>
      );
    },
    size: 130,
  }),
];

// Unified column factory function for all tables
export const getColumns = (
  tableType,
  monthId = null,
  reporters = [],
  user = null
) => {
  switch (tableType) {
    case "tasks":
      // For tasks, we need the hook for memoization and admin logic
      // This will be handled by useTaskColumns in components
      return [];
    case "users":
      return createUserColumns();
    case "reporters":
      return createReporterColumns();
    case "teamDaysOff":
      return createTeamDaysOffColumns();
    default:
      return [];
  }
};
