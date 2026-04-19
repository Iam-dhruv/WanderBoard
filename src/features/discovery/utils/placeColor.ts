// Maps Google Places `types` arrays to WanderBoard palette colors and human labels.

const TYPE_COLOR: Record<string, string> = {
  restaurant:        '#E85D2F', // wb-sunset
  food:              '#E85D2F',
  cafe:              '#E85D2F',
  bakery:            '#E85D2F',
  bar:               '#E85D2F',
  meal_takeaway:     '#E85D2F',
  meal_delivery:     '#E85D2F',
  night_club:        '#7B5EA7', // wb-plum
  lodging:           '#7B5EA7',
  park:              '#6B8F3E', // wb-moss
  natural_feature:   '#6B8F3E',
  campground:        '#6B8F3E',
  zoo:               '#6B8F3E',
  museum:            '#0E6BA8', // wb-ocean
  art_gallery:       '#0E6BA8',
  library:           '#0E6BA8',
  church:            '#0E6BA8',
  hindu_temple:      '#0E6BA8',
  mosque:            '#0E6BA8',
  synagogue:         '#0E6BA8',
  tourist_attraction:'#F5A524', // wb-sun
  amusement_park:    '#F5A524',
  aquarium:          '#F5A524',
  shopping_mall:     '#F5A524',
  store:             '#F5A524',
};

const TYPE_LABEL: Record<string, string> = {
  restaurant:        'Food & Drink',
  food:              'Food & Drink',
  cafe:              'Food & Drink',
  bakery:            'Food & Drink',
  bar:               'Food & Drink',
  meal_takeaway:     'Food & Drink',
  meal_delivery:     'Food & Drink',
  night_club:        'Nightlife',
  lodging:           'Stay',
  park:              'Nature',
  natural_feature:   'Nature',
  campground:        'Nature',
  zoo:               'Nature',
  museum:            'Arts & Culture',
  art_gallery:       'Arts & Culture',
  library:           'Arts & Culture',
  church:            'Landmark',
  hindu_temple:      'Landmark',
  mosque:            'Landmark',
  synagogue:         'Landmark',
  tourist_attraction:'Attraction',
  amusement_park:    'Attraction',
  aquarium:          'Attraction',
  shopping_mall:     'Shopping',
  store:             'Shopping',
};

export function getPlaceColor(types: string[]): string {
  for (const t of types) {
    if (TYPE_COLOR[t]) return TYPE_COLOR[t];
  }
  return '#0F1C2E'; // wb-ink default
}

export function getPlaceLabel(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABEL[t]) return TYPE_LABEL[t];
  }
  return 'Place';
}
