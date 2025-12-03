import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Icons } from "@/components/icons";

const FeaturesSummaryPage = () => {
  const { canAccess } = useAuth();
  const isAdmin = canAccess("admin");



  return (
    <div className="min-h-screen bg-primary py-8 px-4">
      <div className=" mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            SYNC Documentation
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-6">
            Features and systems documentation
          </p>
        </div>

        {/* System Explanation Note */}
        <div className="mb-12 card rounded-lg p-8 border-l-4 border-blue-500 shadow-lg">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
            System & Logic Summary
          </h2>
          
          <div className="space-y-6 text-gray-700 dark:text-gray-300">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">How Everything Works Together</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC is built around a <strong>month-based organization system</strong> where work is tracked in monthly cycles. 
                Each month requires an active board document in PostgreSQL before tasks can be created. Tasks are stored in a hierarchical 
                structure organized by department, year, and month, ensuring clean data organization and efficient querying.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Real-time synchronization</strong> is the backbone of the system. When any user creates, updates, or deletes a task, 
                WebSocket events automatically detect the change and push updates to all connected clients. This means all users see 
                changes instantly without manual page refreshes. The same real-time mechanism applies to deliverables, ensuring the system 
                stays synchronized across all users.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Monthly metrics calculation</strong>: SYNC calculates metrics for each month separately. Tasks, hours, deliverables, 
                and analytics are computed per month. This allows for month-to-month comparison to track progress, identify trends, and analyze 
                performance changes over time. Each month's data is independent, making it easy to compare different periods.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Task Form & Field Logic</h3>
              <p className="text-sm leading-relaxed mb-4">
                The task form uses <strong>conditional field rendering</strong> based on checkbox selections. When "_hasDeliverables" is checked, 
                the deliverables field becomes visible and required. When "_usedAIEnabled" is checked, AI models and AI time fields appear. 
                This prevents form clutter and ensures users only see relevant fields.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Multiple select fields</strong> (MultiSelectField) allow selecting multiple values from a dropdown. Used for markets 
                where a task can span multiple markets. Selected values are stored as arrays and displayed as removable badges. The component 
                filters out already-selected options from the dropdown to prevent duplicates.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Searchable select fields</strong> (SearchableSelectField) provide type-ahead search functionality. As users type, options 
                are filtered in real-time by matching label, name, email, or other searchable properties. The search is case-insensitive and 
                supports partial matches. Used for reporters, users, and deliverables where the list can be long.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Searchable deliverables field</strong> combines search with quantity and variations tracking. When a deliverable is selected, 
                if requiresQuantity=true, quantity and variations fields appear. Variations are only enabled if the deliverable has variationsTime 
                configured. Department filtering automatically filters deliverable options based on selected department.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Task Details Page</h3>
              <p className="text-sm leading-relaxed mb-4">
                The <strong>task details page</strong> shows complete information about a single task. It displays all task fields organized into 
                cards: basic info, time tracking, deliverables, markets, AI usage, and dates. The page uses the same SmallCard component pattern 
                as the dashboard for consistency.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Details page logic</strong>: Gets task ID from URL parameters → finds task in current data → calculates deliverable times 
                → formats dates and arrays → creates detail cards → displays in grid layout. The page handles loading states with skeleton screens 
                and shows error messages if task is not found.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Navigation</strong> to details page happens when clicking on a task. The URL includes task ID and optional filters (user, month) 
                for context. Users can navigate back to dashboard or use browser back button.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Filtering & Search System</h3>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Filter combination logic</strong> uses AND logic - all active filters must match simultaneously. Filters include: month, 
                user, reporter, week, department, deliverable, and task type. Multiple values can be selected for department, deliverable, and 
                task type filters (multi-select), meaning a task matches if it belongs to ANY of the selected values in that filter category.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Searchable filters</strong> use SearchableSelectField components with type-ahead search. All filter dropdowns support 
                real-time search filtering. Global table search filters across all columns simultaneously, while specific filters target individual 
                fields. URL parameters sync filter state for bookmarkable filtered views.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Filter application order</strong>: First apply month/user/reporter/week filters → then apply department/deliverable/task type 
                filters → finally apply global search. This ensures consistent filtering across all analytics and tables. Filters persist 
                across page navigation via URL parameters.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Month Board Creation Logic</h3>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Board creation flow</strong>: Admin selects month → validates monthId format (YYYY-MM) → checks if board already exists 
                → parses monthId to Date object → calculates month info (monthName, daysInMonth, startDate, endDate) → generates unique boardId 
                (board_YYYY-MM_timestamp) → creates PostgreSQL record in months table → sets status='active'.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Board validation</strong> occurs before task creation: Check if month document exists → verify boardId exists → verify 
                status='active'. If any check fails, task creation is prevented with clear error message. Month board banner automatically appears 
                when board is missing, allowing admins to create it with one click.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Month info calculation</strong>: Uses date-fns utilities to calculate month start (first day), month end (last day), 
                daysInMonth, and monthName. All dates are converted to ISO strings for PostgreSQL compatibility. The system handles timezone 
                conversions and ensures consistent date representation.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Calculation Metrics & Variations</h3>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Calculation variations</strong> handle different data scenarios: Base calculations (sum, count, average) → percentage 
                calculations with zero-division handling → time conversions (hours/minutes/days) → deliverable time calculations with quantity 
                and variations → week-based aggregations → category distributions by product/department/market/AI model.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Deliverable calculation variations</strong>: If requiresQuantity=false, only base time (timePerUnit) is used. If 
                requiresQuantity=true, formula is: (timePerUnit × quantity) + (variationsTime × variationsQuantity). Variations are only 
                included if variationsTime &gt; 0. All time is converted to minutes first, then to hours/days for display.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Metric aggregation patterns</strong>: tasks.reduce() for summing hours, tasks.filter().length for counting, 
                sum/count for averages. Category grouping uses Object.groupBy() or reduce() to create distributions. Percentage calculations 
                include fallback to 0% when total is zero to prevent division errors.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Calculation Tables & Data Display</h3>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Analytics tables</strong> display calculated metrics in structured format. Table data is generated by grouping tasks 
                → aggregating metrics → calculating percentages → formatting for display. Tables include columns for categories, task counts, 
                total hours, market distribution, and percentage distributions.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Table calculation logic</strong>: Each row represents a category (product type, market, user, reporter). Columns show 
                metrics (tasks, hours) and sub-metrics (market distribution, percentages). Grand total rows are automatically added showing 
                sums across all categories. Percentages are calculated per row and per column for detailed analysis.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Table data transformation</strong>: Raw task data → filter by active filters → group by category → calculate totals 
                → calculate percentages → format numbers (toFixed for precision) → add grand totals → sort by primary metric (descending) → 
                generate table rows with consistent structure.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Performance & Caching Strategy</h3>
              <p className="text-sm leading-relaxed mb-4">
                The system uses <strong>caching to reduce API calls</strong> and improve performance. Static data 
                like users, reporters, and deliverables are cached since they change infrequently. Month data is cached for 30 days 
                since it only changes once per month. Tasks are never cached and always fetched in real-time to ensure accuracy.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                When data changes, the cache is automatically updated by real-time listeners, keeping cached data fresh. On manual 
                changes (create, update, delete), the cache is cleared first, then the listener updates it with fresh data. This keeps 
                both performance and data accuracy in check.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Note:</strong> The current caching system is basic. A proper cache system will be implemented in a future update to better handle 
                data persistence and invalidation strategies.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Deliverables & Time Calculations</h3>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Deliverables</strong> are tracked with quantity and variations support. The time calculation formula multiplies the time 
                per unit by the quantity, then adds variations time multiplied by variations quantity. This allows for accurate time tracking 
                when deliverables have multiple units or variations. The system automatically converts between hours and minutes, and calculates 
                days based on 8-hour workdays.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                Deliverables are organized by department and can be filtered accordingly. The system supports a "requires quantity" flag that 
                determines whether quantity tracking is needed. When this flag is false, variations are ignored, simplifying the workflow for 
                simple deliverables.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Charts & Visualizations</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC uses <strong>Recharts</strong> for displaying data visualizations. Charts show analytics data in different formats: 
                pie charts for distributions, bar charts for comparisons, and biaxial charts for showing tasks and hours together.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Chart types</strong>: Pie charts show market, product, AI model, and department distributions. Bar charts compare metrics 
                across categories. Biaxial charts display tasks count and hours on separate axes for easy comparison.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>ChartHeader component</strong>: All charts use the ChartHeader component to display titles and badges. ChartHeader shows 
                the chart title, total tasks count, total hours, and other metrics as badges. The component supports different variants (section, 
                default) and color schemes. Badges can display formatted numbers, percentages, and custom text.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Color system</strong>: Uses the <strong>addConsistentColors</strong> algorithm to assign colors. Each category gets a 
                consistent color that stays the same across all charts. Colors are assigned based on category names using hash-based mapping 
                and cached for consistency. Charts update automatically when filters change.
              </p>
                  </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Analytics System & Processing</h3>
              <p className="text-sm leading-relaxed mb-4">
                The analytics system processes tasks by filtering, grouping, and calculating metrics. Each analytics type focuses on different 
                aspects: Marketing shows subcategory distributions, Acquisition shows market focus, Product shows category distribution, AI shows 
                model usage, Reporter shows individual performance, and Markets by Users shows workload distribution.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Analytics types</strong>: Marketing and Acquisition break down by casino/sport subcategories and markets. Product shows 
                category hours and market distribution. AI tracks which models are used and how much time is spent. Reporter shows who created 
                tasks and their market/product focus. Markets by Users creates a table showing which users work on which markets.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Table generation</strong>: Analytics tables show categories as rows with columns for tasks, hours, market distribution, 
                and percentages. Grand total rows sum all categories. Tables are sorted by primary metric and formatted for easy reading.
              </p>
                  </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Security & Data Isolation</h3>
              <p className="text-sm leading-relaxed mb-4">
                The system implements a <strong>two-tier security model</strong> with role-based access control and explicit permissions. Admin 
                users have full access to all features and data. Regular users can only view and edit their own tasks. The permission system 
                checks user status, role, and explicit permissions before allowing any operation.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Data isolation</strong> ensures users only see their own tasks unless they are admins. Task queries automatically filter 
                by user ID for regular users, while admin queries return all tasks. This isolation is applied both client-side and server-side 
                through JWT authentication and role-based access control, providing double-layer protection.
              </p>
                </div>
                
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Week Calculation & Time Tracking</h3>
              <p className="text-sm leading-relaxed mb-4">
                The system calculates <strong>weeks within months</strong> considering only weekdays (Monday through Friday). This ensures accurate 
                weekly reporting that reflects actual working days. Week numbers are assigned sequentially, and tasks can be filtered by week to 
                analyze weekly performance patterns.
              </p>
              <p className="text-sm leading-relaxed">
                All time calculations maintain precision by working in minutes as the base unit, then converting to hours or days for display. 
                This prevents rounding errors and ensures accurate time tracking across deliverables, tasks, and analytics.
              </p>
                </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Layout Cards & Settings</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC uses a <strong>card-based layout system</strong> for organizing information. Cards are created dynamically based on 
                configuration files that define their type, appearance, and behavior. Small cards are used for filters, selections, and quick stats, 
                while large cards display detailed analytics with charts and tables.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Card configuration</strong> is centralized in config files. Each card type has settings for title, icon, color, value calculation, 
                and content rendering. Cards can include form fields (dropdowns, searchable selects) or display calculated metrics. The card system 
                supports different modes (main, analytics, daily) that determine which cards are shown.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Settings management</strong> allows users to configure preferences. Settings are stored and can be customized per user. The system 
                supports role-based settings where admins have access to additional configuration options.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">API & Data Fetching</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC uses <strong>PostgreSQL + Express REST API</strong> as the backend. Data fetching is handled through custom hooks and context 
                providers that manage API calls and WebSocket subscriptions. When data changes, WebSocket events automatically update SYNC state.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>API functions</strong> are organized by feature (tasks, months, deliverables, users). Each feature has create, read, update, 
                and delete operations. API calls handle errors, loading states, and success notifications. The system uses JWT authentication and 
                role-based access control to secure endpoints.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Real-time synchronization</strong> means all users see updates immediately without page refreshes. WebSocket connections are 
                established on login and managed automatically. The system handles connection issues and reconnects automatically.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Utils & Helper Functions</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC has <strong>utility functions</strong> organized by purpose. Date utilities handle parsing, formatting, and calculations. 
                URL parameter utilities manage filter state in browser URLs. Task filter utilities apply filters to task arrays. Form utilities handle 
                validation and field formatting.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Common utilities</strong> include: logger for error tracking, toast for notifications, cache management for data persistence, 
                permission validation for access control, and user preferences for storing settings. These utilities are reused across SYNC.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Utility organization</strong>: Each utility file has a single responsibility. Functions are exported and imported where needed. 
                Utilities don't depend on React components, making them easy to test and reuse. Error handling is built into utilities to prevent crashes.
              </p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Export Data & Table Logic</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC supports <strong>CSV export</strong> for tasks and analytics data. When filters are active, exports include all visible 
                columns. When no filters are active, exports use a simplified format with only key columns (Department, JIRA Link, Market, Total Hours, Deliverables).
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Export functionality</strong>: Table exports format data for CSV, handle dates and arrays, and create downloadable files. Analytics 
                exports convert data objects to CSV format. Export filenames include date stamps for organization.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Table system</strong> uses TanStack Table for sorting, filtering, pagination, and column management. Tables support column visibility 
                toggles, resizing, and custom cell rendering.
              </p>
            </div>

            <div className="pb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white">Technical Stack & Future Plans</h3>
              <p className="text-sm leading-relaxed mb-4">
                SYNC was built with <strong>Vite</strong>, <strong>React</strong>, <strong>Tailwind CSS</strong>, <strong>PostgreSQL</strong>, and <strong>Express</strong>. 
                The current database uses PostgreSQL for storage and WebSockets for real-time data synchronization.
              </p>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Next update:</strong> The system will be migrated to <strong>PostgreSQL</strong> for improved data management, query performance, 
                and more robust relational data handling. This migration will maintain all current functionality while providing better scalability 
                and data integrity.
              </p>
            </div>
              </div>
        </div>



      </div>
    </div>
  );
};

export default FeaturesSummaryPage;




