// Debug logger to surface silent promise rejections and errors during development.
if (typeof window !== 'undefined') {
  if (!window.__DEBUG_LOGGER_INSTALLED__) {
    window.__DEBUG_LOGGER_INSTALLED__ = true;
    window.addEventListener('unhandledrejection', (event) => {
      console.group('%cUnhandled Promise Rejection','color:#b91c1c;font-weight:bold');
      console.log('Reason:', event.reason);
      console.log('Event:', event);
      console.groupEnd();
    });
    window.addEventListener('error', (event) => {
      console.group('%cWindow Error','color:#dc2626;font-weight:bold');
      console.log('Message:', event.message);
      console.log('Source:', event.filename + ':' + event.lineno + ':' + event.colno);
      if (event.error) console.log('Error object:', event.error);
      console.groupEnd();
    });
    console.info('[debugLogger] Global debug listeners attached');
  }
}

export {}; // side-effect module