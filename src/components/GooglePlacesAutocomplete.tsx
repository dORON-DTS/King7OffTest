import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TextField, TextFieldProps, Box, Paper, List, ListItem, ListItemText } from '@mui/material';
import { createPortal } from 'react-dom';

interface GooglePlacesAutocompleteProps extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: boolean;
  helperText?: string;
}

interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
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
  const autocompleteServiceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsAPI = () => {
      const apiKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.error('Google Places API key not found in environment variables');
        return;
      }

      if (window.google && window.google.maps && window.google.maps.places) {

        setIsGoogleLoaded(true);
        initializeServices();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {

        setTimeout(() => {
          if (window.google && window.google.maps && window.google.maps.places) {

            setIsGoogleLoaded(true);
            initializeServices();
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

  const initializeServices = useCallback(() => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      return;
    }

    try {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement('div'));

    } catch (error) {
      console.error('Error initializing Google Places services:', error);
    }
  }, []);

  // Update input position for dropdown positioning
  const updateInputPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setInputRect(rect);
    }
  }, []);

  // Search for places
  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !autocompleteServiceRef.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
             const request = {
         input: query,
         types: ['establishment', 'geocode'],
         language: 'en' // Force English language
       };

      autocompleteServiceRef.current.getPlacePredictions(request, (predictions: PlaceSuggestion[], status: string) => {
        setIsLoading(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
  
          setSuggestions(predictions);
          setShowSuggestions(true);
        } else {

          setSuggestions([]);
          setShowSuggestions(false);
        }
      });
    } catch (error) {
      console.error('Error searching places:', error);
      setIsLoading(false);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  // Handle input change
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    updateInputPosition();
    searchPlaces(newValue);
  }, [onChange, updateInputPosition, searchPlaces]);

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((suggestion: PlaceSuggestion) => {
    // Use structured formatting for cleaner display
    const mainText = suggestion.structured_formatting?.main_text || '';
    const secondaryText = suggestion.structured_formatting?.secondary_text || '';
    
    // Combine main and secondary text for a clean address
    const cleanAddress = secondaryText ? `${mainText}, ${secondaryText}` : mainText;
    
    onChange(cleanAddress);
    setShowSuggestions(false);
    setSuggestions([]);
  }, [onChange]);

  // Handle input focus/blur
  const handleInputFocus = useCallback(() => {
    updateInputPosition();
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length, updateInputPosition]);

  const handleInputBlur = useCallback(() => {
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  }, []);

  // Update position on scroll/resize
  useEffect(() => {
    const handleScroll = () => {
      // Add a small delay to ensure the scroll has finished
      setTimeout(() => updateInputPosition(), 10);
    };
    const handleResize = () => updateInputPosition();
    const handleTouchMove = () => {
      // Handle touch scroll on mobile
      setTimeout(() => updateInputPosition(), 10);
    };

    // Listen to scroll events on the window and all scrollable elements
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('touchmove', handleTouchMove, true);

    // Also listen to scroll events on the dialog content
    const dialogContent = document.querySelector('.MuiDialogContent-root');
    if (dialogContent) {
      dialogContent.addEventListener('scroll', handleScroll, true);
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('touchmove', handleTouchMove, true);
      
      if (dialogContent) {
        dialogContent.removeEventListener('scroll', handleScroll, true);
      }
    };
  }, [updateInputPosition]);

  // Render dropdown portal
  const renderDropdown = () => {
    if (!showSuggestions || !inputRect || suggestions.length === 0) {
      return null;
    }

    const dropdownStyle: React.CSSProperties = {
      position: 'fixed',
      top: inputRect.bottom + window.scrollY,
      left: inputRect.left + window.scrollX,
      width: inputRect.width,
      zIndex: 999999999,
      maxHeight: '200px',
      overflowY: 'auto',
      backgroundColor: '#2d2d2d',
      border: '1px solid #555',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    };

    return createPortal(
      <Paper sx={dropdownStyle}>
        <List dense>
          {suggestions.map((suggestion) => (
            <ListItem
              key={suggestion.place_id}
              button
              onClick={() => handleSuggestionClick(suggestion)}
              sx={{
                '&:hover': {
                  backgroundColor: '#3d3d3d',
                },
                color: 'white',
                py: 1,
              }}
            >
              <ListItemText
                primary={suggestion.structured_formatting?.main_text || suggestion.description}
                secondary={suggestion.structured_formatting?.secondary_text}
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  color: 'white',
                  fontWeight: 'bold',
                }}
                secondaryTypographyProps={{
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              />
            </ListItem>
          ))}
        </List>
      </Paper>,
      document.body
    );
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        {...textFieldProps}
        inputRef={inputRef}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        error={error}
        helperText={helperText || (!isGoogleLoaded ? "Location services not available" : isLoading ? "Searching..." : "")}
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
      {renderDropdown()}
    </Box>
  );
};

export default GooglePlacesAutocomplete; 