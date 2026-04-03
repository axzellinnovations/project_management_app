/**
 * PopupMessage Component - Usage Examples
 * 
 * A beautiful, modern popup message component with type-safe styling
 * and smooth animations.
 */

// ============================================================================
// EXAMPLE 1: Basic Usage in a Component
// ============================================================================

// In your component:
// 'use client';
// import { usePopup } from '@/hooks/usePopup';
// import PopupMessage from '@/app/components/PopupMessage';
//
// export default function MyComponent() {
//   const { popup, showSuccess, close } = usePopup();
//
//   return (
//     <>
//       <button onClick={() => showSuccess('Success!', 'Task created successfully')}>
//         Show Success
//       </button>
//       <PopupMessage
//         isOpen={!!popup}
//         type={popup?.type || 'success'}
//         title={popup?.title || ''}
//         message={popup?.message || ''}
//         onClose={close}
//         duration={popup?.duration}
//       />
//     </>
//   );
// }

// ============================================================================
// EXAMPLE 2: Different Popup Types
// ============================================================================

// const { showSuccess, showError, showWarning, showInfo, close } = usePopup();
//
// Success popup (auto-closes after 5s):
// showSuccess(
//   'Success!',
//   'Your task has been created successfully.'
// );
//
// Error popup (auto-closes after 6s):
// showError(
//   'Error!',
//   'Failed to create task. Please try again.'
// );
//
// Warning popup (auto-closes after 5s):
// showWarning(
//   'Warning!',
//   'This action cannot be undone. Are you sure?'
// );
//
// Info popup (auto-closes after 5s):
// showInfo(
//   'Info',
//   'Your task is scheduled for tomorrow.'
// );

// ============================================================================
// EXAMPLE 3: Popup with Custom Action Button
// ============================================================================

// showError(
//   'Delete Failed!',
//   'Unable to delete the task. Would you like to retry?',
//   0, // duration = 0 means no auto-close
//   {
//     label: 'Retry',
//     onClick: () => {
//       deleteTask();
//     },
//   }
// );

// ============================================================================
// EXAMPLE 4: Using in Kanban Component
// ============================================================================

// 'use client';
// import { usePopup } from '@/hooks/usePopup';
// import PopupMessage from '@/app/components/PopupMessage';
//
// export default function KanbanPage() {
//   const { popup, showSuccess, showError, close } = usePopup();
//
//   const handleDeleteTask = async (taskId: number) => {
//     try {
//       await deleteTask(taskId);
//       showSuccess(
//         'Task Deleted',
//         'The task has been permanently deleted.'
//       );
//     } catch (error) {
//       showError(
//         'Delete Failed',
//         'Unable to delete the task. Please try again.'
//       );
//     }
//   };
//
//   return (
//     <>
//       {/* Your kanban board component */}
//       <PopupMessage
//         isOpen={!!popup}
//         type={popup?.type || 'info'}
//         title={popup?.title || ''}
//         message={popup?.message || ''}
//         onClose={close}
//         duration={popup?.duration}
//         action={popup?.action}
//       />
//     </>
//   );
// }

// ============================================================================
// POPUP TYPES
// ============================================================================

// Types: 'success' | 'error' | 'warning' | 'info'
//
// SUCCESS - Green theme
// - Use for: Action completed successfully
// - Auto-close: 5 seconds
//
// ERROR - Red theme
// - Use for: Something went wrong
// - Auto-close: 6 seconds
//
// WARNING - Yellow theme
// - Use for: Alert or confirmation needed
// - Auto-close: 5 seconds
//
// INFO - Blue theme
// - Use for: Informational messages
// - Auto-close: 5 seconds

// ============================================================================
// FEATURES
// ============================================================================

// ✅ Smooth animations (fade + scale)
// ✅ Auto-close with configurable duration
// ✅ Type-safe props
// ✅ Icon based on popup type
// ✅ Optional action button
// ✅ Close button
// ✅ Backdrop with dismiss on click
// ✅ Accessible (aria-label, keyboard support)
// ✅ Color-coded by type
// ✅ Responsive design
// ✅ Active states for buttons

export {};
