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
  const autocompleteRef = useRef<any>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps API is loaded
    const checkGoogleLoaded = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleLoaded(true);
        initializeAutocomplete();
      } else {
        // Retry after a short delay
        setTimeout(checkGoogleLoaded, 100);
      }
    };

    checkGoogleLoaded();
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google) return;

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'], // Allow both businesses and addresses
        componentRestrictions: { country: 'IL' }, // Restrict to Israel
        fields: ['formatted_address', 'name', 'geometry', 'place_id'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (place.formatted_address) {
          onChange(place.formatted_address);
        } else if (place.name) {
          onChange(place.name);
        }
      });
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <TextField
      {...textFieldProps}
      ref={inputRef}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleInputChange}
      error={error}
      helperText={helperText || (!isGoogleLoaded ? "Loading location services..." : "")}
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
      }}
    />
  );
};

export default GooglePlacesAutocomplete; 