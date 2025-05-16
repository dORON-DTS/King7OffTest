// Try to import web-vitals directly to see what's available
import * as webVitals from 'web-vitals';
console.log('Available exports from web-vitals:', Object.keys(webVitals));

const reportWebVitals = (onPerfEntry?: (metric: any) => void) => {
  console.log('reportWebVitals called with:', onPerfEntry);
  if (onPerfEntry && onPerfEntry instanceof Function) {
    console.log('Attempting to import web-vitals dynamically...');
    import('web-vitals').then((module) => {
      console.log('Dynamic import successful, available exports:', Object.keys(module));
      if (module.onCLS) {
        console.log('Calling onCLS...');
        module.onCLS(onPerfEntry);
      }
      if (module.onFID) {
        console.log('Calling onFID...');
        module.onFID(onPerfEntry);
      }
      if (module.onFCP) {
        console.log('Calling onFCP...');
        module.onFCP(onPerfEntry);
      }
      if (module.onLCP) {
        console.log('Calling onLCP...');
        module.onLCP(onPerfEntry);
      }
      if (module.onTTFB) {
        console.log('Calling onTTFB...');
        module.onTTFB(onPerfEntry);
      }
    }).catch((error) => {
      console.error('Error importing web-vitals:', error);
    });
  }
};

export default reportWebVitals;
