import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useDeliverablesApi } from './useDeliverablesApi';
import { isUserAdmin } from '@/features/utils/authUtils';
import { showError, showSuccess } from '@/utils/toast';
import TanStackTable from '@/components/Table/TanStackTable';
import DynamicButton from '@/components/ui/Button/DynamicButton';
import { SkeletonTable } from '@/components/ui/Skeleton/Skeleton';
import DeliverableFormModal from './DeliverableFormModal';
import { useTableActions } from '@/hooks/useTableActions';
import ConfirmationModal from '@/components/ui/Modal/ConfirmationModal';
import Badge from '@/components/ui/Badge/Badge';
import { TABLE_SYSTEM, CARD_SYSTEM } from '@/constants';
import DepartmentFilter from '@/components/filters/DepartmentFilter';

// ===== CONFIGURATION =====
const CONFIG = {
  MESSAGES: {
    DELETE_SUCCESS: 'Deliverable deleted successfully!',
    DELETE_ERROR: 'Failed to delete deliverable'
  }
};

// ===== DELIVERABLE TABLE COMPONENT =====
const DeliverableTable = ({ 
  className = "", 
  user = null, 
  error = null, 
  isLoading = false, 
  deliverables: propDeliverables = null, 
  onCountChange = null 
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState(null);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState(null);
  const canManageDeliverables = isUserAdmin(user);
  const { deliverables: globalDeliverables, isLoading: loadingSettings, deleteDeliverable } = useDeliverablesApi();
  
  // Table ref for clearing selection
  const tableRef = useRef(null);
  

  // Real-time listener is handled by useDeliverablesApi hook

  // Use data directly from API (already sorted)
  const allDeliverablesData = propDeliverables || globalDeliverables || [];

  // Filter deliverables by selected department
  const deliverablesData = useMemo(() => {
    if (!selectedDepartmentFilter) {
      return allDeliverablesData;
    }
    return allDeliverablesData.filter(deliverable => 
      deliverable.department === selectedDepartmentFilter
    );
  }, [allDeliverablesData, selectedDepartmentFilter]);

  useEffect(() => {
    if (onCountChange) onCountChange(deliverablesData?.length || 0);
  }, [deliverablesData?.length, onCountChange]);

  // Delete wrapper for useTableActions
  const handleDeleteDeliverable = async (deliverable) => {
    try {
      if (!deliverable?.id) {
        throw new Error('Deliverable ID is required for deletion');
      }
      await deleteDeliverable(deliverable.id, user);
      // Success toast is handled by useTableActions hook
      // Real-time listener will automatically update the UI
    } catch (error) {
      showError(CONFIG.MESSAGES.DELETE_ERROR);
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
    closeDeleteModal,
    handleEditSuccess,
  } = useTableActions('deliverable', {
    getItemDisplayName: (deliverable) => deliverable?.name || 'Unknown Deliverable',
    deleteMutation: handleDeleteDeliverable,
    onDeleteSuccess: () => {
      // Clear table selection after delete
      tableRef.current?.clearSelection();
    },
    onSelectSuccess: () => {
      // Don't clear selection immediately for view action
    }
  });

  // Handle edit deliverable
  const handleEditDeliverable = (deliverable) => {
    setEditingDeliverable(deliverable);
    setShowCreateModal(true);
  };

  // Handle edit success
  const handleEditDeliverableSuccess = () => {
    setShowCreateModal(false);
    setEditingDeliverable(null);
    handleEditSuccess();
    // Clear table selection after edit
    tableRef.current?.clearSelection();
  };

  // Handle edit modal close
  const handleEditModalClose = () => {
    setShowCreateModal(false);
    setEditingDeliverable(null);
  };

  const columns = useMemo(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ getValue }) => <span className="font-medium text-gray-900 dark:text-white text-xs">{getValue()}</span>,
      size: 200,
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ getValue }) => {
        const department = getValue();
        if (!department) return <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>;
        return (
          <Badge variant="green" size="sm">
            {department}
          </Badge>
        );
      },
      size: 150,
    },
    {
      accessorKey: "timePerUnit",
      header: "Time Per Unit",
      cell: ({ getValue, row }) => {
        const timePerUnit = getValue();
        const timeUnit = row.original.timeUnit || '';
        if (!timePerUnit) {
          return <span className="text-gray-500 dark:text-gray-400 text-xs">-</span>;
        }
        return (
          <Badge variant="purple" size="sm">
            {timePerUnit} {timeUnit}
          </Badge>
        );
      },
      size: 120,
    },
    {
      accessorKey: "variationsTime",
      header: "Variations Time",
      cell: ({ getValue, row }) => {
        const variationsTime = getValue();
        const timeUnit = row.original.variationsTimeUnit || 'min';
        if (!variationsTime || variationsTime === 0) {
          return <span className="text-gray-500 dark:text-gray-400 text-xs">None</span>;
        }
        return (
          <Badge variant="pink" size="sm">
            {variationsTime} {timeUnit}
          </Badge>
        );
      },
      size: 120,
    },
    {
      accessorKey: "declinariTime",
      header: "Declinari Time",
      cell: ({ getValue, row }) => {
        const declinariTime = getValue();
        const timeUnit = row.original.declinariTimeUnit || 'min';
        if (!declinariTime || declinariTime === 0) {
          return <span className="text-gray-500 dark:text-gray-400 text-xs">None</span>;
        }
        return (
          <Badge variant="orange" size="sm">
            {declinariTime} {timeUnit}
          </Badge>
        );
      },
      size: 120,
    },
    {
      accessorKey: "requiresQuantity",
      header: "Requires Quantity",
      cell: ({ getValue }) => {
        const requiresQuantity = getValue();
        return (
          <Badge 
            variant={requiresQuantity ? 'green' : 'gray'} 
            size="sm"
          >
            {requiresQuantity ? 'Yes' : 'No'}
          </Badge>
        );
      },
      size: 120,
    },
  ], []);

  // Handle department filter change
  const handleDepartmentFilterChange = useCallback((fieldName, value) => {
    if (fieldName === 'departmentFilter') {
      // If clicking the same department filter or clearing, deselect it
      if (selectedDepartmentFilter === value || !value) {
        setSelectedDepartmentFilter(null);
      } else {
        // Select the new department filter
        setSelectedDepartmentFilter(value);
      }
    }
  }, [selectedDepartmentFilter]);

  // Create department filter component using shared component
  const departmentFilterComponent = useMemo(() => (
    <DepartmentFilter
      selectedDepartmentFilter={selectedDepartmentFilter}
      onFilterChange={handleDepartmentFilterChange}
    />
  ), [selectedDepartmentFilter, handleDepartmentFilterChange]);

  // Memoized bulk actions
  const bulkActions = useMemo(() => [
    {
      label: "View Selected",
      icon: "eye",
      variant: "secondary",
      onClick: (selectedDeliverables) => {
        if (selectedDeliverables.length === 1) {
          handleSelect(selectedDeliverables[0]);
        } else {
          showError("Please select only ONE deliverable to view");
        }
      }
    },
    {
      label: "Edit Selected",
      icon: "edit",
      variant: "primary",
      onClick: (selectedDeliverables) => {
        if (selectedDeliverables.length === 1) {
          handleEditDeliverable(selectedDeliverables[0]);
        } else {
          showError("Please select only ONE deliverable to edit");
        }
      }
    },
    {
      label: "Delete Selected",
      icon: "delete",
      variant: "crimson",
      onClick: async (selectedDeliverables) => {
        if (selectedDeliverables.length === 1) {
          handleDelete(selectedDeliverables[0]);
        } else {
          showError("Please select only ONE deliverable to delete");
        }
      }
    }
  ], [handleSelect, handleEditDeliverable, handleDelete]);

  if (isLoading || loadingSettings) return <SkeletonTable className={className} />;

  return (
    <div className={`deliverable-table ${className}`}>
      {/* Info message when no deliverables */}
      {deliverablesData.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No deliverables found. Click "Add Deliverable" to create your first deliverable.
          </p>
        </div>
      )}

      <TanStackTable
        ref={tableRef}
        data={deliverablesData}
        columns={columns}
        tableType="deliverables"
        isLoading={isLoading}
        onSelect={handleSelect}
        onEdit={handleEditDeliverable}
        onDelete={handleDelete}
        enableRowSelection={canManageDeliverables}
        showBulkActions={canManageDeliverables}
        bulkActions={bulkActions}
        showFilters={true}
        showPagination={true}
        showColumnToggle={true}
        enablePagination={true}
        enableFiltering={true}
        pageSize={TABLE_SYSTEM.DEFAULT_PAGE_SIZE}
        customFilter={departmentFilterComponent}
      />

      {/* Edit Deliverable Modal */}
      <DeliverableFormModal
        isOpen={showCreateModal}
        onClose={handleEditModalClose}
        mode={editingDeliverable ? 'edit' : 'create'}
        deliverable={editingDeliverable}
        onSuccess={handleEditDeliverableSuccess}
        user={user}  // Pass user prop
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Delete Deliverable"
        message={`Are you sure you want to delete "${itemToDelete?.name || 'this deliverable'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={rowActionId === itemToDelete?.id}
      />
    </div>
  );
};

export default DeliverableTable;
