import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { updateURLParams, updateURLParam, getURLParam } from "@/utils/urlParams";

export const useURLFilters = (filterKeys = []) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get all current filter values from URL
  const filters = useMemo(() => {
    const result = {};
    filterKeys.forEach((key) => {
      result[key] = getURLParam(searchParams, key);
    });
    return result;
  }, [searchParams, filterKeys]);

  // Helper to update a single filter
  const updateFilter = useCallback((key, value) => {
    updateURLParam(setSearchParams, key, value);
  }, [setSearchParams]);

  // Helper to update multiple filters at once
  const updateFilters = useCallback((updates) => {
    updateURLParams(setSearchParams, updates);
  }, [setSearchParams]);

  return {
    filters,
    updateFilter,
    updateFilters,
    searchParams,
    setSearchParams,
  };
};

