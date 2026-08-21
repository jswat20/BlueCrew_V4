// Authoritative Lake Shore Youth Baseball rules displayed in The Slate.
// Source: LSYB Playing Rules, revised March 19, 2026.
const RULES_AND_REGULATIONS = Object.freeze({
  revised: "March 19, 2026",
  sourceUrl: "https://cdn2.sportngin.com/attachments/document/60a0-3547856/LSYB_Playing_Rules_3-17-2026__1_.pdf",
  sourceNote: "Source: Lake Shore Youth Baseball Playing Rules, revised March 19, 2026.",
  coOpNotice: "The Lake Shore playing rules will be in effect for all in-house games. Games between Lake Shore teams and Co-Op teams will be governed by the Co-Op rules and Lake Shore Rule Extensions, Additions, and Exceptions will not apply.",
  divisions: Object.freeze([
    Object.freeze({
      id: "clinic",
      name: "Clinic",
      subtitle: "Coach Pitch",
      sections: Object.freeze([
        { title: "General", rules: [
          "This division shall follow the NFHS rules for this division except where modified herein.",
          "Games will be provided with a junior umpire appointed by the Junior Umpire Coordinator.",
          "For the spring season, a player’s age is his age on August 31 of the current year. A player may not be older than 7 to play in the Clinic division.",
          "A rostered player shall not also be on another Co-op, travel, or select team.",
          "Teams may not borrow players."
        ]},
        { title: "Field & Equipment", rules: [
          "50-foot bases. A pitching line approximately 35 feet from the plate. A fair ball Arc approximately 8 feet in front of the plate.",
          "There will be three Basepath Marks (half-way between first and second, second and third, and third and home) used to position runners to the nearest base when play is stopped.",
          "The Lake Shore field maintenance crew will be responsible for preparing the field for play.",
          "The Home Team shall select its dugout before the Visiting Team.",
          "The Visiting Team is entitled to use the infield for practice beginning 30 minutes before the scheduled start of the game. The Visiting Team must yield the infield to the home team 15 minutes before the scheduled start of the game.",
          "Both teams shall supply one NEW game ball, and one GOOD back-up ball.",
          "All bats must conform to USA Baseball standards. Metal and composite bats must feature the USABat certification mark, and be listed on the www.usabat.com website. Solid, one-piece wood bats may be used with or without the USA Baseball mark.",
          "Plastic cleats are permitted, but not required.",
          "Protective cups are NOT required.",
          "SAFETY. Batters and base runners must wear helmets at all times. There is only one batter allowed on deck at a time. The only players allowed to swing a bat are the batter and the on deck hitter.",
          "All helmets must have a full face protective wire cage."
        ]},
        { title: "Game & Innings", rules: [
          "There will be a short pre-game conference held at home plate between opposing managers to discuss these and any other ground rules.",
          "A regular game is 6 innings, a shortened game (for time, weather, etc.) is official (won’t be rescheduled) if both teams have batted 4 or more full innings.",
          "No new inning shall start after 1½ hours from the start time.",
          "There will be a maximum of 5 runs per inning, except in the 6th or extra innings, which are open. Regular season games can end in a tie.",
          "There is a 10 run mercy rule in this division. If any team is ahead by 10 or more runs after the completion of 4 or more innings, the game will end."
        ]},
        { title: "Batting & Base running", rules: [
          "All players on the roster will bat continuously. The order must be announced prior to game time, but no later than the pre-game conference.",
          "A team may start with any number of players. If a player must leave the game for any reason, he is simply removed from the batting order. Any player arriving late is inserted at the end of the batting order.",
          "A batter shall be declared out after failing to hit a fair ball after the coach pitcher delivers six pitches. The batter is out if there are three strikes before the sixth pitch. Only missed swings are counted as strikes, as are foul balls and foul tips. A batter is not out on an uncaught foul ball or a foul tip even if it is the sixth pitch.",
          "Batter and runners may advance as far as they can on a batted ball that leaves the infield dirt and enters the outfield. Batter and runners are limited to one (1) base on balls that do not leave the infield.",
          "The ball is considered dead once an infielder possesses the ball in the infield dirt. Runners advancing more than one base that have not made it more than halfway to the next base when the ball is dead, will return to the last touched base. The ball is dead once the infielder possesses the ball from the outfielder and no plays or tag out can be attempted by the infielder (i.e. throw from outfielder comes to shortstop, runner is two steps off second and gets tagged, the runner remains at second base because they were not more than half way to third at the time the shortstop possessed the ball and must return to second base).",
          "For balls hit in the infield only, infielders may make outs via force outs or tag outs. (i.e. ball hit to shortstop, runner on second, runner runs to 3rd and shortstop tags the runner, the runner is out).",
          "For fly balls, runners are not permitted to tag up. Fly balls caught will be a dead ball once caught (infield or outfield) and runners will be returned to the base they started from.",
          "First and third base coaches are permitted in the coaching boxes to coach the runners. If a base coach touches a base runner during a live play, the runner will be declared out and the coach will receive a warning. If the coach commits the violation a second time he must be removed from base coaching duties.",
          "Bunting is NOT permitted.",
          "Leading off is NOT permitted. Players cannot leave the base until the bat makes contact with the ball.",
          "Stealing is NOT permitted.",
          "Players are allowed to slide into any base except 1st Base.",
          "If a batted ball hits a coach, the ball is dead. The pitch is a foul strike and no runners may advance. If a live ball hits the coach pitcher or in the umpire's judgment the coach interferes in the fielder's attempt to make a play, the ball is dead and the lead runner is out."
        ]},
        { title: "Pitching", rules: [
          "The manager or a coach pitches to the batters.",
          "The batter may receive not more than 6 pitches, good or bad. If a fair ball is not hit after 6 pitches, the batter is out. The batter will be allowed to continue batting if the last pitch is a foul tip or foul ball.",
          "The manager or a coach will pitch overhand to the batters either from a standing position or from one knee, with at least one foot behind the pitching line. A fielder shall take the position beside the coach at the pitching plate.",
          "If a coach pitcher hits a batter with a pitch, the pitch will count against the 6-pitch limit and the batter shall NOT be awarded first base."
        ]},
        { title: "Fielding", rules: [
          "All players are in the field on defense.",
          "The catcher must wear a catcher’s helmet and mask, and stand or squat behind home plate. The catcher is used to make plays at home and field balls hit near the plate.",
          "A player is placed as a fielding pitcher near the mound, no closer than 35 feet. The remaining players are placed in the regular infield positions. Additional fielders should be distributed in the regular outfield positions. A defensive coach is permitted, and encouraged, to be on the field behind players for instructional purposes. Coaches are not to touch a live ball, with only 10 players in the field on defense.",
          "Outfielders must be positioned 15 feet behind the infielders.",
          "Except in the case of an injury or parent request, no player shall sit for consecutive innings.",
          "Each player must play at least two innings in the infield positions, unless the parent or player opposes.",
          "The ball is considered dead once an infielder has fielded the ball and made a throw to a base, or an outfielder has returned the ball back to the infield dirt AND the ball is possessed by an infielder. The ball is dead once the infielder possesses the ball from the outfielder and no plays or tag out can be attempted by the infielder (i.e. throw from outfielder comes to shortstop, runner is two steps off second and gets tagged, the runner remains at second base because they were not more than half way to third at the time the shortstop possessed the ball and must return to second base).",
          "For balls hit in the infield only, infielders may make outs via force outs or tag outs. (i.e. ball hit to shortstop, runner on second, runner runs to 3rd and shortstop tags the runner, the runner is out).",
          "For fly balls, runners are not permitted to tag up. Fly balls caught will be a dead ball once caught (infield or outfield) and runners will be returned to the base they started from.",
          "No extra bases on overthrows by infielders, in play or out of play.",
          "2 or 3 defensive coaches are permitted on the field to guide the players in the fielding of their positions."
        ]}
      ])
    }),
    Object.freeze({
      id: "pinto",
      name: "Pinto",
      subtitle: "Kid Pitch",
      sections: Object.freeze([
        { title: "General", rules: [
          "This division shall follow the NFHS rules for this division except where modified herein.",
          "The Lake Shore Junior Umpire Coordinator will appoint umpires for all Pinto games. If an umpire does not show, the Home Team shall notify the Junior Umpire Coordinator of the situation and follow guidance if applicable.",
          "For the spring season, a player’s age is his or her age on August 31 of the current year. A player may not be older than 8 to play in this division.",
          "A rostered player shall not also be on another Co-op, travel, or select team.",
          "Teams may not borrow players."
        ]},
        { title: "Field & Equipment", rules: [
          "50-foot bases.",
          "Three Basepath Marks, half-way between first and second, second and third, and third and home; used to position runners to the nearest base when play is stopped.",
          "Players will pitch from the pitching rubber at 40’. The coach rescue point will be a horizontal line approximately 35 feet from home plate. The coach must pitch from behind this line.",
          "The Lake Shore field maintenance crew will be responsible for preparing the field for play.",
          "The Home Team shall select its dugout before the Visiting Team.",
          "The Visiting Team is entitled to use the infield for practice beginning 30 minutes before the scheduled start of the game. The Visiting Team must yield the infield to the home team 15 minutes before the scheduled start of the game.",
          "Both teams shall supply one NEW game ball, and one GOOD back-up ball. A regular hard ball is used in this division.",
          "All bats must conform to USA Baseball standards. Metal and composite bats must feature the USABat certification mark, and be listed on the www.usabat.com website. Solid, one-piece wood bats may be used with or without the USA Baseball mark.",
          "Metal cleats are NOT permitted.",
          "All male players MUST wear a protective cup when catching, and recommended for all other positions.",
          "SAFETY. Batters and base runners must wear helmets at all times. There is only one batter allowed on deck at a time. The only players allowed to swing a bat are the batter and the on deck hitter.",
          "All helmets must have a full face protective wire cage."
        ]},
        { title: "Game & Innings", rules: [
          "There will be a short pre-game conference held at home plate between opposing managers to discuss these and any other ground rules.",
          "A regular game is 6 innings. A shortened game (for time, weather, etc.) is official if it has completed 4 innings.",
          "No new inning shall start after 1 ½ hours from the start time.",
          "A Run Limit of 5 innings for all innings except the last inning, and any extra innings. When the time limit is approaching, a “Last Inning” may be declared if both managers agree before the start of the top of that inning.",
          "This division will have a modified \"10 run rule\". Once a team is ahead by 10 or more runs after 4 complete innings, the game will be considered officially over. Once the 10 run criteria have been met, the official game score will be recorded as complete, but the game may continue as a scrimmage for developmental purposes. During this extended time, the winning coach will avoid putting the team's best players in key positions and focus on developing other players.",
          "Games may end in a tie, if the score is tied after the last complete inning."
        ]},
        { title: "Batting & Base running", rules: [
          "All players on the roster will bat continuously. The order must be announced prior to game time, but no later than the pre-game conference.",
          { text: "A team may start with 8 players and the 9th spot IS NOT AN OUT. If the ninth or more players show up late, that player will be put in the last spot in the lineup. If a player must leave the game for any reason, it must be permanent, and the team will NOT be charged with an out.", subrules: ["If a player leaves early and misses his scheduled at bat, the team may elect to take an out at his position in order to maintain the player’s eligibility for the game."] },
          "The Dropped Third Strike rule shall NOT be enforced. The batter is automatically out on strike three whether or not the catcher holds on to the third strike.",
          "Bunting is NOT permitted. A deliberately attempted bunt is a foul ball.",
          "Leading off is NOT permitted. Players cannot leave the base until the bat makes contact with the ball.",
          { text: "Stealing is permitted as follows:", subrules: ["No other base runners are allowed to advance on this play.", "No advancement further then second base is allowed.", "One successful steal per inning is allowed.", "There are no count or out requirements."] },
          "No head-first sliding at any base or plate. Do not teach players to collide with defensive players. Offending runner shall be called out.",
          "A Courtesy Runner for the catcher is permitted at any time. The courtesy runner must be the most recent batted out. The player removed for the courtesy runner must catch the next inning. The umpire may disallow this substitution if it is not speeding up the game.",
          "Batter and runners may advance as far as they can on a batted ball that leaves the infield dirt and enters the outfield. Batters and runners are limited to one (1) base on balls that do not leave the infield. Except on overthrows to first base, ALL runners will be able to advance 1 base on overthrows to first base.",
          "For balls hit into the outfield, the ball is considered dead once an infielder possesses the ball in the infield dirt. Runners advancing more than one base that have not made it more than halfway to the next base when the ball is dead, will return to the last touched base. However, the fielder is permitted to attempt a play to get the runner out. The runner may only advance to the base of attempt, bases will not be awarded for overthrows unless the ball is thrown out of play. For example, a ball is hit to left field, shortstop catches the ball and runner is rounding second and attempts third the shortstop can attempt a throw to third and runner can only go to third. In the event the runner is not halfway, and the shortstop does not make an attempt the runner must return to second base.",
          "Runners will be awarded ONE base on an overthrow if the ball goes out of play.",
          "If a batted ball hits a coach, the ball is dead. The pitch is a foul strike and no runners may advance. If a live ball hits the coach pitcher or in the umpire's judgment the coach interferes in the fielder's attempt to make a play, the ball is dead and the lead runner is out."
        ]},
        { title: "Pitching", rules: [
          { text: "Upon the 4th ball (non-strike), the coach will come into rescue, and the strike count will remain the same and all subsequent strikes, whether a called strike by the umpire or swinging, will count toward the pitch count. A batter hit by a ball pitched by a coach is NOT awarded 1st base.", subrules: ["In a coach rescue situation, the manager or a coach will pitch overhand to the batters either from a standing position or from one knee from behind the 35’ line. A fielder shall take the position beside the coach at the pitching plate."] },
          "Maximum innings for any one pitcher in any one game is 2 innings. Once a pitcher throws one pitch in an inning, that is considered a full inning.",
          "Once a pitcher is removed from the mound, he CAN NOT be brought back in to pitch for the remainder of that game.",
          "A pitcher who hits two batters in the same inning shall be removed and cannot re-enter as a pitcher.",
          { text: "Pitchers may pitch no more than 3 innings for the day. “Day” refers to a calendar day (midnight to midnight).", subrules: ["Pitchers are allowed to pitch two days in row as long as the player doesn't throw more than 3 innings in combination of the two days. In order to be eligible to pitch 2 days in a row, the first day total must only be 1 inning (not the maximum) in order not to trigger the 40-hour rest rule.", "A 40-hour minimum rest (from start of game) is required between starts when maximum innings are pitched in a game or in a day.", "Pitchers pitching 2 days in a row must rest 40 hours no matter how many innings are pitched."] },
          "Pitchers are not allowed to pitch more than 6 innings for the week. A “week” refers to a calendar week running from Monday through Sunday."
        ]},
        { title: "Fielding", rules: [
          "10 players are on the field on defense. The 10th player must play in the outfield, and all outfielders must play at least 30 feet behind the infield. Short-sided teams (8 or 9 players) must field a pitcher, catcher, and 4 infielders.",
          "You Pay, You Play - a minimum of four innings in the field per 6 inning game, and a minimum of 2 of those in the infield. To the maximum extent possible, all players shall play in the field equally.",
          "Runners may not advance on overthrows by Infielders except on overthrows to first base.",
          "The Infield Fly rule shall NOT be enforced.",
          "No hidden ball tricks.",
          "1st half of season - One defensive coach is permitted in the outfield to guide the players in the fielding of their positions."
        ]}
      ])
    })
  ])
});
