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
        //moderator: "#9518f2",
        //mentor: "#ee57ff",
        admin: "#ffea49"
    };
    const leaderboardObserver = new MutationObserver(colorPlayers);
    //key: playername, value: {color, text}
    const loadedPlayers = new Map();

    resizeLeaderboard();
    resizeCubesPanel();
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
            if(leaderboard.competition_id !== null) { //do not color names if a competition is displayed
                return;
            }

            let mutationsIndex = 0;

            for(let i = 0; i < data.length; i++) {
                if(mutations[mutationsIndex] && mutations[mutationsIndex].addedNodes.length === 0) { //only care about mutations where a node has been added
                    mutationsIndex++;
                }

                processPlayer(data, mutations[mutationsIndex++], data[i].username);
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
            let playerData = loadedPlayers.get(name);

            updatePlayerColor(nameSpan, playerData.color);
            updatePlayerText(nameSpan, playerData.text);
        }
        else {
            $.getJSON(`/1.0/player/${name}/bio`, function(data) {
                let color = Colors.player;
                let roles = data.roles;
                let text = "";

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
                        text += "📖 "; //space so that the potential mentor emoji has a little breathing space
                    }

                    if(roles.includes("mentor") || isAdmin) { //always show the icon for admins
                        text += "🗨";
                    }
                }

                savePlayer(nameSpan, name, {color: color, text: text});
            }).fail(function() {
                console.warn(`Failed to color ${name} in the leaderboard, falling back to default player color.`);
                savePlayer(nameSpan, name, {color: Colors.player, text: ""});
            });
        }
    }

    function savePlayer(element, playerName, data) {
        updatePlayerColor(element, data.color);
        updatePlayerText(element, data.text);
        loadedPlayers.set(playerName, data);
    }

    function updatePlayerColor(element, color) {
        element.childNodes[0].style.color = color;
    }

    function updatePlayerText(element, text) {
        if(text) { //only modify if the player has text to display, aka if they're a mod or a mentor
            let data = loadedPlayers.get(name);
            let icons = element.getElementsByClassName("modmentorindicator");

            if(icons.length === 0) {
                let flagImg = element.childNodes[1] ? element.childNodes[1].cloneNode() : null; //not all users have a flag set
                let iconSpan = document.createElement("span");
                let flagIconSpan = document.createElement("span");

                if(flagImg) {
                    element.childNodes[1].remove(); //remove the old img node
                    flagIconSpan.appendChild(flagImg);
                }

                iconSpan.setAttribute("class", "modmentorindicator");
                iconSpan.setAttribute("style", "padding-left: 5px;");
                iconSpan.innerText = text;
                flagIconSpan.appendChild(iconSpan);
                element.appendChild(flagIconSpan);
            }
            else {
                icons.innerText = text;
            }
        }
    }

    function resizeLeaderboard() {
        const widerLeaderboardStyle = document.createElement("style");
        const usernameColumnWidth = ".leaderRowHeader span:nth-child(2), .leaderRow span:nth-child(2) {width: 160px;}"; //increase username column width
        const wideLeaderboard = "#ovlbContainer {width: 310px}"; //increase leaderboard width
        const normalLeaderboard = "#ovlbContainer {width: 280px}";

        widerLeaderboardStyle.setAttribute("id", "widerLeaderboard");
        widerLeaderboardStyle.innerHTML = usernameColumnWidth + wideLeaderboard;
        document.head.appendChild(widerLeaderboardStyle);

        //fixes the leaderboard not completely disappearing off the screen when dismissed
        document.getElementById("dismiss-leaderboard").onclick = function() {
            widerLeaderboardStyle.innerHTML = usernameColumnWidth + normalLeaderboard;
        };
        document.getElementById("recall-leaderboard").onclick = function() {
            widerLeaderboardStyle.innerHTML = usernameColumnWidth + wideLeaderboard;
        };
    }

    function resizeCubesPanel() {
        const playerAddons = JSON.parse(localStorage.getItem("playerAddons")); //used to check if the cubes addon is enabled so its display can be widened as well

        if(playerAddons) {
            for(let addon of playerAddons) {
                if(addon.name === "Cubes") {
                    const interval = setInterval(function() {
                        let cubesPanel = document.getElementById("ews-cubes-panel");

                        if(cubesPanel) {
                            clearInterval(interval);

                            cubesPanel.style.width = "310px"; //make the cubes script panel the same width as the leaderboard

                            for(let tab of cubesPanel.getElementsByClassName("ews-cubes-tab")) {
                                tab.setAttribute("style", "margin-left: 6px"); //add more space between the tab buttons
                            }
                        }
                    }, 100);

                    return;
                }
            }
        }
    }
})();