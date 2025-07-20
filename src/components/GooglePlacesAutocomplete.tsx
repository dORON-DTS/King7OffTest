import React, { useEffect, useRef, useState } from 'react';
import { TextField, TextFieldProps } from '@mui/material';

interface GooglePlacesAutocompleteProps extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: boolean;
  helperText?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter location...",
  label = "Location",
  error = false,
  helperText,
  ...textFieldProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps API dynamically
    const loadGoogleMapsAPI = () => {
      const apiKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.error('Google Places API key not found in environment variables');
        return;
      }

      // Check if already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log('Google API already loaded');
        setIsGoogleLoaded(true);
        setTimeout(() => initializeAutocomplete(), 100);
        return;
      }

      // Load the script with the new API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google API script loaded');
        setTimeout(() => {
          if (window.google && window.google.maps && window.google.maps.places) {
            console.log('Google API fully initialized');
            setIsGoogleLoaded(true);
            initializeAutocomplete();
          } else {
            console.error('Google API failed to initialize');
            setIsGoogleLoaded(false);
          }
        }, 500);
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps API');
        setIsGoogleLoaded(false);
      };
      document.head.appendChild(script);
    };

    loadGoogleMapsAPI();
  }, []);

  // Re-initialize autocomplete when inputRef changes
  useEffect(() => {
    if (isGoogleLoaded && inputRef.current) {
      initializeAutocomplete();
    }
  }, [isGoogleLoaded]);

  const initializeAutocomplete = () => {
    console.log('Initializing new PlaceAutocompleteElement...', { 
      hasInputRef: !!inputRef.current, 
      hasGoogle: !!window.google,
      hasMaps: !!(window.google && window.google.maps),
      hasPlaces: !!(window.google && window.google.maps && window.google.maps.places),
    });

    if (!inputRef.current || !window.google) {
      console.log('Missing inputRef or Google API');
      return;
    }

    if (!window.google.maps) {
      console.log('Google Maps not loaded yet');
      return;
    }

    if (!window.google.maps.places) {
      console.log('Google Places API not loaded yet');
      return;
    }

    try {
      // Use the new PlaceAutocompleteElement API
      const autocomplete = new window.google.maps.places.PlaceAutocompleteElement({
        inputElement: inputRef.current,
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'IL' },
      });

      // Listen for place selection using addEventListener
      autocomplete.addEventListener('gmp-placeselect', (event: any) => {
        const place = event.detail.place;
        console.log('Place selected:', place);
        
        if (place.formatted_address) {
          onChange(place.formatted_address);
        } else if (place.name) {
          onChange(place.name);
        }
      });

      console.log('PlaceAutocompleteElement initialized successfully');
    } catch (error) {
      console.error('Error initializing PlaceAutocompleteElement:', error);
      // Fallback to regular text input
      setIsGoogleLoaded(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <TextField
      {...textFieldProps}
      inputRef={inputRef}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleInputChange}
      error={error}
      helperText={helperText || (!isGoogleLoaded ? "Location services not available" : "")}
      fullWidth
      variant="outlined"
      sx={{
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: 'grey.700',
          },
          '&:hover fieldset': {
            borderColor: 'grey.500',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'primary.main',
          },
        },
        '& .MuiInputLabel-root': {
          color: 'grey.400',
        },
        '& .MuiInputBase-input': {
          color: 'white',
        },
        // Fix z-index for Google Autocomplete dropdown
        '& .pac-container': {
          zIndex: 999999999,
          position: 'fixed !important',
          pointerEvents: 'auto !important',
        },
        // Ensure the input field itself doesn't block the dropdown
        position: 'relative',
        zIndex: 1,
      }}
    />
  );
};

export default GooglePlacesAutocomplete; 