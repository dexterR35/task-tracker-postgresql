export const updateURLParams = (setSearchParams, updates, replace = true) => {
  const currentParams = new URLSearchParams(window.location.search);
  const paramsObj = Object.fromEntries(currentParams.entries());
  
  // Apply updates
  Object.entries(updates).forEach(([key, value]) => {
    if (!value || value === "") {
      delete paramsObj[key];
    } else {
      paramsObj[key] = value;
    }
  });
  
  setSearchParams(paramsObj, { replace });
};

export const updateURLParam = (setSearchParams, key, value, replace = true) => {
  updateURLParams(setSearchParams, { [key]: value }, replace);
};

export const getURLParam = (searchParams, key, defaultValue = "") => {
  return searchParams.get(key) || defaultValue;
};

