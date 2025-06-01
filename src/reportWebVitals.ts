// Try to import web-vitals directly to see what's available
import * as webVitals from 'web-vitals';

const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then((module) => {
      if (module.onCLS) {
        module.onCLS(onPerfEntry);
      }
      if (module.onFID) {
        module.onFID(onPerfEntry);
      }
      if (module.onFCP) {
        module.onFCP(onPerfEntry);
      }
      if (module.onLCP) {
        module.onLCP(onPerfEntry);
      }
      if (module.onTTFB) {
        module.onTTFB(onPerfEntry);
      }
    }).catch(() => {});
  }
};

export default reportWebVitals;
