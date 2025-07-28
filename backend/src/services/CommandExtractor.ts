export interface GameCommand {
  type: 'movement' | 'action' | 'game_specific';
  command: string;
  confidence: number;
  rawText: string;
  matchScore?: number; // 1.0 for trigger word, 1.5 for 2 words, 2.0 for full phrase
}

export class CommandExtractor {
  // Mapping of trigger words to full phrases
  private static readonly PHRASE_MAP: { [key: string]: string } = {
    // Absurd animal phrases
    'wifi': 'pandas hack wifi',
    'gravity': 'squirrels fight gravity',
    'homework': 'llamas eat homework',
    'rockets': 'turtles launch rockets',
    'tuxedos': 'pigeons rock tuxedos',
    'waves': 'cows surf waves',
    'math': 'chickens study math',
    'cookies': 'dolphins bake cookies',
    'poetry': 'monkeys compose poetry',
    'sweaters': 'sharks knit sweaters',
    'insurance': 'beavers sell insurance',
    'murals': 'eagles paint murals',
    'ferraris': 'snails race ferraris',
    'yoga': 'owls teach yoga',
    'castles': 'crabs build castles',
    'chess': 'whales play chess',
    'restaurants': 'bats open restaurants',
    'websites': 'foxes code websites',
    'podcasts': 'bears host podcasts',
    'hair': 'wolves braid hair',
    'storms': 'goats forecast storms',
    'revolutions': 'sheep lead revolutions',
    'tacos': 'horses sell tacos',
    'karate': 'ducks practice karate',
    'ninjas': 'geese become ninjas',
    'helicopters': 'rabbits fly helicopters',
    'kingdoms': 'mice rule kingdoms',
    'symphonies': 'rats compose symphonies',
    'mysteries': 'bees solve mysteries',
    'pyramids': 'ants build pyramids',
    'pizza': 'jellyfish deliver pizza',
    'marathons': 'starfish run marathons',
    'crime': 'seahorses fight crime',
    'saxophone': 'walrus plays saxophone',
    'pineapples': 'seals juggle pineapples',
    'bands': 'otters start bands',
    'dance': 'platypus teaches dance',
    'bitcoin': 'koalas invest bitcoin',
    'rainbows': 'zebras paint rainbows',
    'volleyball': 'giraffes play volleyball',
    'novels': 'hippos author novels',
    'bread': 'rhinos bake bread',
    'professionally': 'elephants moonwalk professionally',
    'vacuums': 'tigers sell vacuums',
    'mittens': 'lions knit mittens',
    'ceramics': 'cheetahs teach ceramics',
    'computers': 'leopards fix computers',
    'opera': 'panthers sing opera',
    'origami': 'jaguars fold origami',
    'parties': 'pumas host parties',
    'coffee': 'badgers brew coffee',
    'hearts': 'raccoons charm hearts',
    'screenplays': 'possums draft screenplays',
    'drums': 'armadillos play drums',
    'physics': 'porcupines teach physics',
    'bicycles': 'hedgehogs race bicycles',
    'pools': 'moles dig pools',
    'flowers': 'wombats sell flowers',
    'mainframes': 'flamingos hack mainframes',
    'spotlight': 'peacocks grab spotlight',
    'loudly': 'parrots gossip loudly',
    'nails': 'toucans paint nails',
    'feelings': 'pelicans catch feelings',
    'magic': 'herons practice magic',
    'lawyers': 'swans become lawyers',
    'jazz': 'geese honk jazz',
    'chaos': 'doves spread chaos',
    'cupcakes': 'vultures sell cupcakes',
    'kindergarten': 'hawks teach kindergarten',
    'submarines': 'falcons race submarines',
    'socks': 'eagles snatch socks',
    'backwards': 'condors fly backwards',
    'poorly': 'ostriches hide poorly',
    'war': 'emus wage war',
    'high': 'kiwis bounce high',
    'internet': 'penguins surf internet',
    'portraits': 'puffins paint portraits',
    'fast': 'sloths run fast',
    'jokes': 'anteaters tell jokes',
    'ballads': 'tapirs sing ballads',
    'hard': 'capybaras chill hard',
    'spaceships': 'beavers build spaceships',
    'boats': 'otters hijack boats',
    'mockingly': 'seals clap mockingly',
    'salsa': 'walruses dance salsa',
    'jets': 'manatees race jets',
    'knights': 'narwhals joust knights',
    'gossip': 'beluga whales gossip',
    'masterpieces': 'orcas paint masterpieces',
    'systems': 'dolphins hack systems',
    'fortunes': 'porpoises tell fortunes',
    'disco': 'whales sing disco',
    'blogs': 'squid publish blogs',
    'treasure': 'octopi grab treasure',
    'reality': 'crabs pinch reality'
  };

  private static readonly COMMANDS = {
    // Movement commands
    movement: {
      go: ['go', 'move', 'forward', 'advance'],
      left: ['left', 'turn left', 'go left'],
      right: ['right', 'turn right', 'go right'],
      stop: ['stop', 'halt', 'freeze'],
      back: ['back', 'reverse', 'backward'],
    },
    
    // Action commands
    action: {
      jump: ['jump', 'hop', 'leap'],
      fire: ['fire', 'shoot', 'bang'],
      draw: ['draw'],
      duck: ['duck', 'crouch', 'down'],
    },
    
    // Game-specific commands (can be extended per game mode)
    gameSpecific: {
      // Voice Racer
      boost: ['boost', 'turbo', 'speed'],
      brake: ['brake', 'slow'],
      
      // Quick Draw
      ready: ['ready'],
      
      // Word Bridge - categories will be dynamic
    }
  };

  /**
   * Extracts a game command from transcribed text
   * @param dynamicWords - Optional array of dynamic words to check (e.g., player-specific words)
   */
  static extract(text: string, confidence: number, dynamicWords?: string[]): GameCommand | null {
    const normalizedText = text.toLowerCase().trim();
    
    console.log(`[CommandExtractor] Processing text: "${text}" -> normalized: "${normalizedText}"`);
    console.log(`[CommandExtractor] Dynamic words to check: ${dynamicWords?.join(', ') || 'none'}`);
    
    // First check dynamic words (highest priority)
    if (dynamicWords && dynamicWords.length > 0) {
      for (const word of dynamicWords) {
        const wordLower = word.toLowerCase();
        const fullPhrase = this.PHRASE_MAP[wordLower];
        
        console.log(`[CommandExtractor] Checking word "${wordLower}", full phrase: "${fullPhrase}"`);
        
        // Calculate match score based on how much of the phrase was said
        let matchScore = 1.0; // Default for trigger word only
        
        if (fullPhrase) {
          const phraseLower = fullPhrase.toLowerCase();
          const phraseWords = phraseLower.split(' ');
          
          // Check if the entire phrase was said
          if (normalizedText === phraseLower || normalizedText.includes(phraseLower)) {
            console.log(`[CommandExtractor] FULL PHRASE MATCH: "${normalizedText}" contains "${phraseLower}"`);
            matchScore = 2.0; // Full phrase bonus
            return {
              type: 'game_specific',
              command: wordLower,
              confidence,
              rawText: text,
              matchScore
            };
          }
          
          // Check for partial phrase matches (2 out of 3 words)
          if (phraseWords.length >= 3) {
            // Check last 2 words (e.g., "teach pottery" from "cheetahs teach pottery")
            const lastTwo = phraseWords.slice(-2).join(' ');
            console.log(`[CommandExtractor] Checking last two words: "${lastTwo}"`);
            if (normalizedText.includes(lastTwo)) {
              console.log(`[CommandExtractor] PARTIAL MATCH (last 2): "${normalizedText}" contains "${lastTwo}"`);
              matchScore = 1.5;
              return {
                type: 'game_specific',
                command: wordLower,
                confidence,
                rawText: text,
                matchScore
              };
            }
            
            // Check first 2 words (e.g., "cheetahs teach" from "cheetahs teach pottery")
            const firstTwo = phraseWords.slice(0, 2).join(' ');
            console.log(`[CommandExtractor] Checking first two words: "${firstTwo}" (also checking for trigger word "${wordLower}")`);
            if (normalizedText.includes(firstTwo) && normalizedText.includes(wordLower)) {
              console.log(`[CommandExtractor] PARTIAL MATCH (first 2): "${normalizedText}" contains "${firstTwo}" and "${wordLower}"`);
              matchScore = 1.5;
              return {
                type: 'game_specific',
                command: wordLower,
                confidence,
                rawText: text,
                matchScore
              };
            }
          }
        }
        
        // Check for trigger word only
        console.log(`[CommandExtractor] Checking trigger word only: does "${normalizedText}" contain "${wordLower}"?`);
        if (normalizedText === wordLower || normalizedText.includes(wordLower)) {
          console.log(`[CommandExtractor] TRIGGER WORD MATCH: "${normalizedText}" contains "${wordLower}"`);
          return {
            type: 'game_specific',
            command: wordLower,
            confidence,
            rawText: text,
            matchScore: 1.0
          };
        }
        
        // Partial match for words 3+ chars (e.g., "zoo" matches "zoom")
        if (wordLower.length >= 3 && normalizedText.length >= 2) {
          if (wordLower.startsWith(normalizedText) && normalizedText.length >= wordLower.length * 0.6) {
            return {
              type: 'game_specific',
              command: wordLower,
              confidence: confidence * 0.9, // Slightly lower confidence for partial match
              rawText: text,
              matchScore: 0.8 // Lower score for partial matches
            };
          }
        }
      }
    }
    
    // Check movement commands
    for (const [command, variants] of Object.entries(this.COMMANDS.movement)) {
      if (this.matchesAnyVariant(normalizedText, variants)) {
        return {
          type: 'movement',
          command,
          confidence,
          rawText: text
        };
      }
    }
    
    // Check action commands
    for (const [command, variants] of Object.entries(this.COMMANDS.action)) {
      if (this.matchesAnyVariant(normalizedText, variants)) {
        return {
          type: 'action',
          command,
          confidence,
          rawText: text
        };
      }
    }
    
    // Check game-specific commands
    for (const [command, variants] of Object.entries(this.COMMANDS.gameSpecific)) {
      if (this.matchesAnyVariant(normalizedText, variants)) {
        return {
          type: 'game_specific',
          command,
          confidence,
          rawText: text
        };
      }
    }
    
    return null;
  }

  /**
   * Checks if text matches any variant of a command
   */
  private static matchesAnyVariant(text: string, variants: string[]): boolean {
    // First check for exact matches with multi-word phrases
    for (const variant of variants) {
      if (text === variant) return true;
    }
    
    // For single-word variants, check if they appear as a complete word
    for (const variant of variants) {
      if (variant.includes(' ')) {
        // Multi-word variant - check if it's contained in the text
        if (text.includes(variant)) return true;
      } else {
        // Single-word variant - check word boundaries to avoid partial matches
        const wordRegex = new RegExp(`\\b${variant}\\b`);
        if (wordRegex.test(text)) {
          // Make sure we're not matching a word that's part of a multi-word command
          // For example, don't match "left" in "turn left" if "turn left" is also a variant
          const isPartOfLongerCommand = variants.some(v => 
            v.includes(' ') && v.includes(variant) && text.includes(v)
          );
          if (!isPartOfLongerCommand) return true;
        }
      }
    }
    
    // Check for repeated single words (e.g., "go go go")
    const words = text.split(' ');
    if (words.length > 1) {
      for (const variant of variants) {
        if (!variant.includes(' ') && words.every(word => word === variant)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Special handler for "GO GO GO" pattern in racing game
   */
  static extractRacerBoost(text: string): number {
    const normalizedText = text.toLowerCase().trim();
    const goCount = (normalizedText.match(/go/g) || []).length;
    
    // More "go"s = more boost (up to 3)
    return Math.min(goCount, 3);
  }

  /**
   * Validates if a word belongs to a category (for Word Bridge game)
   */
  static validateCategoryWord(word: string, category: string): boolean {
    // This would typically use a more sophisticated categorization system
    // For MVP, we'll use simple predefined lists
    const categories: { [key: string]: string[] } = {
      animals: ['cat', 'dog', 'bird', 'fish', 'lion', 'tiger', 'bear', 'elephant', 'monkey', 'zebra'],
      colors: ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white', 'pink', 'brown'],
      foods: ['pizza', 'burger', 'apple', 'banana', 'bread', 'cheese', 'chicken', 'rice', 'pasta', 'salad'],
      sports: ['soccer', 'football', 'basketball', 'tennis', 'golf', 'baseball', 'hockey', 'swimming', 'running', 'cycling'],
    };
    
    const categoryWords = categories[category.toLowerCase()];
    if (!categoryWords) return false;
    
    return categoryWords.includes(word.toLowerCase());
  }

  /**
   * Get confidence threshold for different command types
   */
  static getConfidenceThreshold(commandType: string): number {
    // Different commands might need different confidence levels
    switch (commandType) {
      case 'movement':
        return 0.7; // Higher threshold for movement to avoid accidental moves
      case 'action':
        return 0.8; // Even higher for actions like fire/draw
      case 'game_specific':
        return 0.6; // Lower for game-specific words
      default:
        return 0.7;
    }
  }
}