================================================================================
  TYPO THE GAME   Version 1.0.0.  March 10 2026 
  A fast-paced word typing game for macOS
  
  https://waynecater.com
================================================================================

  Requires macOS 14.0 (Sonoma) or later.


--------------------------------------------------------------------------------
  HOW TO PLAY
--------------------------------------------------------------------------------

  Words fall from the top of the screen. Type each word exactly as shown and
  press Return to destroy it before it reaches the bottom.

  - 3 misses and the game is over.
  - Your score is the total number of letters in every word you successfully
    type. Longer words = more points.
  - Missed words stack up at the bottom as a reminder of what got away.
  - Speed increases with every level — stay sharp!


--------------------------------------------------------------------------------
  DIFFICULTY LEVELS
--------------------------------------------------------------------------------

  Easy    --  Words fall at a relaxed pace. Great for warming up or learning
              the game. Uses shorter, common words.

  Medium  --  A balanced challenge. Words spawn faster and the vocabulary
              grows. Recommended for most players.

  Hard    --  High speed, longer words, and very little time to think.
              For players who live on the keyboard.

  Each difficulty has its own background music track that sets the mood.
  Speed increases automatically every N words typed (default: 7 words per
  level). You can adjust this in the Word List Editor.


--------------------------------------------------------------------------------
  KEYBOARD CONTROLS
--------------------------------------------------------------------------------

  Typing          Match a falling word — just start typing, no need to click.
                  Matching is case-insensitive.

  Return / Enter  Submit your typed word. If it matches a falling word,
                  that word disintegrates and you score its letters.

  Space           Clear the input field instantly. Use this to recover from
                  a typo and start fresh.

  Escape          Opens the quit confirmation dialog mid-game. Handy if you
                  need to bail out or take a break.


--------------------------------------------------------------------------------
  HUD & INTERFACE
--------------------------------------------------------------------------------

  Top bar (left to right):

    Checkmark + number   Words successfully typed this round.

    Text icon + number   Your current letter score (pts).

    Difficulty label     Shows Easy, Medium, or Hard.

    Level indicator      Your current speed level. Color shifts as it climbs:
                           Green = Level 0 (starting speed)
                           Yellow = Level 1
                           Orange = Level 2
                           Red = Level 3 and beyond

    Music button (♩)     Click to mute or unmute the background music.
                         Green = music on. Gray = muted.

    Miss coins           Three spinning coins in the top-right corner.
                         Each coin you lose turns gray. Lose all three
                         and the game ends.

  In the game area:

    Red horizontal line  The danger zone. Any word that crosses this line
                         is counted as a miss.

    "Here we go!"        Shown at the start of each game while the intro
                         sound plays. The game begins once it fades.

    "FASTER!"            Flashes on screen each time you reach a new level
                         and the words speed up.


--------------------------------------------------------------------------------
  SOUNDS
--------------------------------------------------------------------------------

  Intro sound     Plays quietly when you start the game, during the
                  "Here we go!" splash.

  Background music  Starts after the intro fades. Loops for the entire game.
                    Each difficulty has a unique track.

  Word blast      Plays when you successfully type and destroy a word.

  Explosion       Plays when a word reaches the bottom (a miss).

  Game over       Plays when you lose your third life.

  You can mute the background music at any time with the ♩ button in the HUD.
  Your mute preference is saved between sessions.


--------------------------------------------------------------------------------
  WORD LIST EDITOR  (Menu -> Edit Words)
--------------------------------------------------------------------------------

  The built-in editor lets you customise the word pool:

  - Browse words by difficulty tab (Easy / Medium / Hard).
  - Add new words by typing in the field and pressing Return.
  - Delete words with a swipe gesture.
  - Toggle a word's active state with the switch — inactive words are shown
    with a strikethrough and won't appear in gameplay.
  - Reassign a word to a different difficulty using the menu picker.
  - Filter to show only your custom-added words.
  - Search across all difficulties (type 3 or more characters).
  - Import a plain text file of words (one word per line).
  - Reset everything back to the original default word list.

  Words per Level slider:
    Use the +/- buttons to set how many words you must type before the
    speed increases. Lower = faster ramp-up. Higher = more breathing room.
    Range: 1 to 50. Default: 7.


--------------------------------------------------------------------------------
  LEADERBOARD  (Menu -> Leaderboard)
--------------------------------------------------------------------------------

  - Stores the top 50 scores across all difficulties.
  - Sorted by score (highest first).
  - Columns: Rank, Name, Score, Words, Level Reached, Difficulty, Date.
  - After a game, enter your name on the Game Over screen to save your score.
    Leave the name blank and it saves as "Anonymous."
  - Your new entry flashes yellow and scrolls into view automatically.
  - Scores that fall outside the top 50 are not saved.


--------------------------------------------------------------------------------
  TIPS & TRICKS
--------------------------------------------------------------------------------

  - Prioritise longer words. A 9-letter word scores more than three 3-letter
    words. Let short words fall if a long one is closer to the danger line.

  - Watch the danger line, not just the words. Peripheral awareness of which
    words are lowest will keep you alive longer.

  - Space is your reset button. The moment you mistype, hit Space and start
    the word again — don't backspace character by character under pressure.

  - Raise "Words per Level" if you want to practise without the constant
    speed escalation. Lower it for an intense challenge.

  - Hard mode rewards both typing speed AND spelling accuracy. If you know
    your vocabulary, Hard is where the real scores live.

  - The word pool is entirely yours to edit. Add technical jargon, names,
    or any custom vocabulary to make the game your own.

