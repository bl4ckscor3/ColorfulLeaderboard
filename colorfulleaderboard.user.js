// ==UserScript==
// @name         Colorful Leaderboard
// @namespace    bl4ckscor3
// @version      0.2
// @description  Colors users in their role's color on EyeWire's leaderboard and adds icons to indicate whether they're a moderator and/or mentor
// @author       bl4ckscor3
// @match        https://eyewire.org/
// @grant        none
// @updateURL    https://raw.githubusercontent.com/bl4ckscor3/ColorfulLeaderboard/master/colorfulleaderboard.user.js
// @downloadURL  https://raw.githubusercontent.com/bl4ckscor3/ColorfulLeaderboard/master/colorfulleaderboard.user.js
// @homepageURL  https://github.com/bl4ckscor3/ColorfulLeaderboard
// ==/UserScript==

/* globals $ account leaderboard */

(function() {
    'use strict';

    const Colors = {
        player: "#1de61d",
        scout: "#95fbe4",
        scythe: "#21a9ed",
        mystic: "#ff6666",
        admin: "#ffea49"
    };
    const Settings = {
        colorNames: "color-names",
        markModsMentors: "mark-mods-mentors",
        reorderFlags: "reorder-flags",
        hideLeaderboard: "hide-leaderboard"
    };
    const checkAccount = setInterval(function() {
        if(typeof account === "undefined" || !account.account.uid) { //is the account accessible yet?
            return; //if not, try again
        }

        clearInterval(checkAccount); //if yes, stop trying and start the actual script
        main();
    }, 100);

    function main() {
        const leaderboardObserver = new MutationObserver(colorPlayers);
        const settingsCheck = setInterval(initSettings, 100);
        //key: playername, value: {color, isMod, isMentor}
        const loadedPlayers = new Map();

        if(getLocalSetting(Settings.hideLeaderboard, false)) {
            $("#ovlbContainer").removeClass("onscreen");
            $("#recall-leaderboard").addClass("onscreen");
        }

        function startObserving() {
            leaderboardObserver.observe(document.getElementById("leaderboard"), {
                childList: true,
                attributes: false,
                characterData: false,
                subtree: false
            });
        }

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

                        if(roles.includes("moderator") || isAdmin) { //always mark admins as moderators
                            isMod = true;
                        }

                        if(roles.includes("mentor") || isAdmin) { //always mark admins as mentors
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
            reorderFlag(element);
        }

        function updatePlayerColor(element, color) {
            if(getLocalSetting(Settings.colorNames, true) && leaderboard.competition_id === null) { //do not color names during competitions
                element.getElementsByTagName("span")[0].style.color = color;
            }
        }

        function updatePlayerInfo(element, isMod, isMentor) {
            if(getLocalSetting(Settings.markModsMentors, true) && leaderboard.competition_id === null) { //do not style names during competitions
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

        function reorderFlag(element) {
            if(element && getLocalSetting(Settings.reorderFlags, true)) {
                let flagImg = element.childNodes[1] ? element.childNodes[1].cloneNode() : null; //not all users have a flag set
                let noLeftMargin = "margin-left: 0px;";

                if(flagImg) {
                    element.childNodes[1].remove();
                    flagImg.setAttribute("style", noLeftMargin + "margin-right: 5px");
                }
                else{
                    flagImg = document.createElement("span"); //placeholder
                    flagImg.setAttribute("style", noLeftMargin + "margin-right: 21px");
                }

                element.prepend(flagImg);
            }
        }

        function initSettings() {
            if(!document.getElementById("cubeInspectorFloatingControls")) {
                return;
            }

            clearInterval(settingsCheck);

            var menu = document.getElementById("settingsMenu");
            var category = document.createElement("div");

            category.setAttribute("class", "settings-group ews-settings-group invisible");
            category.innerHTML = '<h1>Leaderboard</h1>';
            menu.appendChild(category);
            addToggleSetting(category, Settings.colorNames, "Color players in their highest rank's color", true);
            addToggleSetting(category, Settings.markModsMentors, "Mark moderators and mentors", true);
            addToggleSetting(category, Settings.reorderFlags, "Show flags in front of players' names", true);
            addToggleSetting(category, Settings.hideLeaderboard, "Hide the leaderboard by default in the overview", false);
            startObserving();
        }

        function addToggleSetting(category, id, description, defaultValue) {
            var state = getLocalSetting(id, defaultValue);
            var setting = document.createElement("div");
            var checkbox = document.createElement("checkbox");

            setting.setAttribute("class", "setting");
            setting.innerHTML = `<span>${description}</span>`;
            checkbox.setAttribute("class", `checkbox ${state ? "on" : "off"}`);
            checkbox.innerHTML = `
                <div class="checkbox-handle"></div>
                <input type="checkbox" id="hmp-${id}" checked="${state ? "checked" : ""}" style="display: none;">`;
            setting.appendChild(checkbox);
            category.appendChild(setting);

            setting.onclick = function(e) {
                var toggle = setting.getElementsByTagName("input")[0];
                var newState = !toggle.checked;

                e.stopPropagation();
                setLocalSetting(id, newState);
                toggle.checked = newState;
                checkbox.setAttribute("class", `checkbox ${newState ? "on" : "off"}`);
                onSettingChanged(id, newState);
            };

            onSettingChanged(id, state);
        }

        function setLocalSetting(setting, value) {
            localStorage.setItem(account.account.uid + "-clb-" + setting, value);
        }

        function getLocalSetting(setting, defaultValue) {
            var storedValue = localStorage.getItem(account.account.uid + "-clb-" + setting);

            if(storedValue === null) {
                setLocalSetting(setting, defaultValue);
                return defaultValue;
            }
            else {
                return typeof defaultValue === "boolean" ? storedValue === "true" : storedValue;
            }
        }

        function onSettingChanged(id, state) { //trigger the ews-setting-changed event and update the lookup map with the new value
            $(document).trigger('ews-setting-changed', {setting: id, state: state});
        }
    }
})();