import React, { useRef, useState } from 'react';
import { TextField, TextFieldProps, List, ListItem, ListItemText, Paper, Box } from '@mui/material';

interface GooglePlacesAutocompleteProps extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: boolean;
  helperText?: string;
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
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
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchLocations = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=il&limit=5`
      );
      const data = await response.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    searchLocations(newValue);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
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
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        error={error}
        helperText={helperText || (isLoading ? "Searching..." : "")}
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
      
      {showSuggestions && suggestions.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            maxHeight: 200,
            overflow: 'auto',
            bgcolor: '#2d2d2d',
            border: '1px solid #555',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            mt: 1,
          }}
        >
          <List dense>
            {suggestions.map((suggestion, index) => (
              <ListItem
                key={index}
                button
                onClick={() => handleSuggestionClick(suggestion)}
                sx={{
                  '&:hover': {
                    bgcolor: '#3d3d3d',
                  },
                  color: 'white',
                }}
              >
                <ListItemText
                  primary={suggestion.display_name}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    color: 'white',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default GooglePlacesAutocomplete; 