// ==UserScript==
// @name         Colorful Leaderboard
// @namespace    bl4ckscor3
// @version      0.1
// @description  Colors users in their role's color on EyeWire's leaderboard and adds icons to indicate whether they're a moderator and/or mentor
// @author       bl4ckscor3
// @match        https://eyewire.org/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/bl4ckscor3/ColorfulLeaderboard/master/colorfulleaderboard.user.js
// @downloadURL  https://raw.githubusercontent.com/bl4ckscor3/ColorfulLeaderboard/master/colorfulleaderboard.user.js
// @homepageURL  https://github.com/bl4ckscor3/ColorfulLeaderboard
// ==/UserScript==

/* globals $ leaderboard */

(function() {
    'use strict';

    const Colors = {
        player: "#1de61d",
        scout: "#95fbe4",
        scythe: "#21a9ed",
        mystic: "#ff6666",
        admin: "#ffea49"
    };
    const leaderboardObserver = new MutationObserver(colorPlayers);
    //key: playername, value: {color, isMod, isMentor}
    const loadedPlayers = new Map();

    leaderboardObserver.observe(document.getElementById("leaderboard"), {
        childList: true,
        attributes: false,
        characterData: false,
        subtree: false
    });

    function colorPlayers(mutations) { //the leaderboard mutates only when it is reloaded, so mutations only contains the leaderboard entries
        if(mutations.length === 0) {
            return;
        }

        //request the leaderboard to get the full names of players (sometimes, names are cut off using ...)
        let request = leaderboard.country ? `/1.0/stats/top/user/in/country/${leaderboard.country}/by/points/per/` : "/1.0/stats/top/user/by/points/per/";

        $.getJSON(request + leaderboard.timeframe, function(data) {
            let mutationsIndex = 0;

            for(let i = 0; i < data.length; i++) {
                if(mutations[mutationsIndex] && mutations[mutationsIndex].addedNodes.length === 0) { //only care about mutations where a node has been added
                    mutationsIndex++;
                }

                let indexToUse = mutationsIndex++;

                if(!mutations[indexToUse]) {
                    continue;
                }

                processPlayer(data, mutations[indexToUse], data[i].username);
            }
        });
    }

    function processPlayer(data, element, name) {
        if(!element || element.addedNodes.length === 0) {
            return;
        }

        let entry = element.addedNodes[0]; //<div class="leaderRow">...</div>
        let nameSpan = entry.childNodes[1]; //<span><span>name</span><img ...></span>

        if(loadedPlayers.has(name)) {
            updatePlayer(nameSpan, loadedPlayers.get(name));
        }
        else {
            $.getJSON(`/1.0/player/${name}/bio`, function(data) {
                let color = Colors.player;
                let roles = data.roles;
                let isMod = false;
                let isMentor = false;

                if(roles.length !== 0) {
                    let isAdmin = false;

                    if(roles.includes("admin")) {
                        color = Colors.admin;
                        isAdmin = true;
                    }
                    else if(roles.includes("mystic")) {
                        color = Colors.mystic;
                    }
                    else if(roles.includes("scythe")) {
                        color = Colors.scythe;
                    }
                    else if(roles.includes("scout")) {
                        color = Colors.scout;
                    }

                    if(roles.includes("moderator") || isAdmin) { //always show the icon for admins
                        isMod = true;
                    }

                    if(roles.includes("mentor") || isAdmin) { //always show the icon for admins
                        isMentor = true;
                    }
                }

                saveAndUpdatePlayer(nameSpan, name, {color: color, isMod: isMod, isMentor: isMentor});
            }).fail(function() {
                console.warn(`Failed to color ${name} in the leaderboard, falling back to default player color.`);
                saveAndUpdatePlayer(nameSpan, name, {color: Colors.player, isMod: false, isMentor: false});
            });
        }
    }

    function saveAndUpdatePlayer(element, playerName, data) {
        updatePlayer(element, data);
        loadedPlayers.set(playerName, data);
    }

    function updatePlayer(element, data) {
        updatePlayerColor(element, data.color);
        updatePlayerInfo(element, data.isMod, data.isMentor);
    }

    function updatePlayerColor(element, color) {
        if(leaderboard.competition_id === null) { //do not color names during competitions
            element.getElementsByTagName("span")[0].style.color = color;
        }
    }

    function updatePlayerInfo(element, isMod, isMentor) {
        if(leaderboard.competition_id === null) { //do not style names during competitions
            //mark the name italics and underline for mod/mentor
            var textStyle = `color: ${element.childNodes[0].style.color};`;

            if(isMod) {
                textStyle += "font-style: italic;";
            }

            if(isMentor) {
                textStyle += "text-decoration: underline;";
            }

            element.childNodes[0].style = textStyle;
        }
    }
})();