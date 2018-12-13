// doFetchRequest method
function doFetchRequest(method, url, headers, body){
    if (arguments.length !== 4) {
        throw err;
    }
    if(method === "GET" || method === "POST" || method === "DELETE" || method === "PUT"){
        if (method === "GET"){
            if(body){
                throw err;
            }
            else {
                return fetch(url, {
                    method: method,
                    headers: headers,
                    credentials: "same-origin"
                });
            }
        }
        else if (method === "POST" || method === "PUT"){
            if(body === null || typeof body === "string"){
                if(method === "PUT"){
                    return fetch(url, {
                        method: method,
                        body: body,
                        headers: headers
                    });
                }
                else if (method === "POST"){
                    return fetch(url, {
                        method: method,
                        body: body,
                        headers: headers
                    });
                }
                else{
                    throw err;
                }

            }
            else{
                throw err;
            }
        }
        else if (method === "DELETE"){
            return fetch(url, {
                method: method,
                headers: headers
            });
        }
        else {
            console.log("method not correct")
            throw err;
        }

    }
    else{
        console.log("error");
        throw err;
    }
}

function doJSONRequest(method, url, headers, body){
    if (arguments.length !== 4) {
        throw err;
    }
    if (headers["Content-Type"] && headers["Content-Type"] !== "application/json") {
        throw err;
    }

    if (headers["Accept"] && headers["Accept"] !== "application/json") {
        throw err;
    }

    headers['Accept'] = 'application/json';
    if (method === "POST" || method === "PUT"){
        headers["Content-Type"] = "application/json";
        return doFetchRequest(method, url, headers, JSON.stringify(body)).then((result) => result.json());
    }
    if (method === "GET" || method === "DELETE"){
        return doFetchRequest(method, url, headers, body).then((result) => {
            return result.json()
        });
    }
    throw err;
}


  /***************************/
 /**Board preview rendering**/
/***************************/ 

function getBoardPrev(id){
    console.log(id);
    // take all the the board ids and render all the boards 
    doJSONRequest('GET', "/board/" + id,{}, undefined)
    .then((board)=>{
      dust.render('partials\/board_partial', board ,function(err, dataOut) {
                    // if(err) console.log(err);
                    document.getElementById('posted-boards').innerHTML += dataOut;
        });
    });
};

  /***************************/
 /**User update and render **/
/***************************/ 

function userUpdate(){
    doJSONRequest('GET', "/user", {}, undefined)
    .then(function(user) {
        user.avatarLetters = user.firstname.charAt(0) + user.lastname.charAt(0);
        dust.render('partials\/userpage_title', user, function(err, dataOut) {
            // out contains the rendered HTML string.
            if(err) console.log(err);
            document.getElementById('usr-page-title').innerHTML = dataOut;
        });
        dust.render('partials\/user_info', user, function(err, dataOut){
            if(err) {
                console.log(err);
            }
            document.getElementById('usr-info').innerHTML = dataOut;
        });
        dust.render('partials/user_update_pp', user,function(err, dataOut){
            document.getElementById('usr-update-pp').innerHTML = dataOut;
        })
    });
}

  /***************************/
 /****** Create new board ***/
/***************************/ 
function boardCreate(){
    doJSONRequest('POST', "/board", {}, {name: document.getElementById('board-name').value})
    .then(function(board) {
        getBoardPrev(board._id);
    }).catch((err)=>{
        alert("Invalid board name");
    });
}


/*Search and render users on board to invite*/

// used for search function -> used to render "filtered" favorites
function userSearchRender(users){
    dust.render('partials\/board_usr_search_pp', {result: users} ,function(err, dataOut) {
                   document.getElementById('found-user').innerHTML = dataOut;
    });
  }

//search user to invite 
function search(text) {
    if (text==""){
        let nosearch = document.createElement('P').innerHTML = "Search for someone";
        document.getElementById('found-user').innerHTML = nosearch;
    }else{
        doFetchRequest('GET', "/user/search?search="+text, {'Accept': 'application/json'}, undefined)
        .then((res) => {
            return res.json();
        })
        .then((users) => {
            userSearchRender(users);
        });
    }
}

//add user to board
function userAdd(){
    if (document.getElementById('invite-box').value === ""){
        return; 
    }
    doFetchRequest('GET', "/user/search?search="+document.getElementById('invite-box').value, 
                        {'Accept': 'application/json'}, undefined)
    .then((res) => {
        return res.json();
    })
    .then((users) => {
        let board_id = document.getElementsByTagName('main')[0].id;
        users.forEach((user) => {
            doJSONRequest('PUT', '/board/new-user', {}, {boardId: board_id, userId: user._id})
            .catch((err) => {
                console.log(err);
            });
        })
    })
    .catch((err) => {
        console.log(err);
    })
}


/**
 * Fetches and renders lists of this board, then for each list renders the
 * tasks of the list.
 * @author wize
 * @version 0 (10 Dec 2018)
 * @param {string} boardId the id of the board
 * @returns {Promise} a promise that the board will be rendered
 */
function boardGetLists(boardId) {
    return new Promise(function(resolve, reject) {
        doJSONRequest(
            "GET", 
            "/board/" + boardId,
            {},
            undefined
        )
        .then(function(board) {
            const lists = board.lists;
            function renderLists(pointerToCurrent=0) {
                const listSpace = document.getElementById("list-space");
                if(pointerToCurrent >= lists.length) {
                    return;
                }
                if(document.getElementById(lists[pointerToCurrent]._id) !== null) {
                    renderLists(pointerToCurrent + 1);
                    return;
                }
                dust.render("partials/boardPartial", lists[pointerToCurrent], function(err, html) {
                    if(err) {
                        console.log(err);
                    }

                    let listDOM = document.createElement("div");

                    listDOM.draggable = true;
                    listDOM.className = "droptarget movable-column";
                    listDOM.id = lists[pointerToCurrent]._id;
                    listDOM.innerHTML = html;

                    listSpace.appendChild(listDOM);
                    renderLists(pointerToCurrent + 1);
                });
                while (listSpace.childNodes.length > 0) {
                    let child = listSpace.childNodes[0];
                    newTaskButton(child);
                    listSpace.parentElement.insertBefore(child, listSpace);
                    let hiddenDiv = document.createElement('div');
                    hiddenDiv.className = "hidden-div";
                    listSpace.parentElement.insertBefore(hiddenDiv, listSpace);
                    child.firstElementChild.addEventListener('blur', (element) => {
                        element = element.srcElement;
                        let listName = element.innerHTML;
                        let listId = element.parentNode.id;
                        let boardId = document.querySelector(".droptarget-column").id;
                        doJSONRequest('PUT', "/list", {'Content-Type': 'application/json'}, 
                        {boardId: boardId,
                        listId: listId,
                        listName: listName
                        })
                        .catch((error) => {
                            throw error;
                        });
                    });
                }
            };

            document.getElementById("list-space").innerHTML = "";
            renderLists();
            return board;
        })
        .then(function(board) {
            if(board.lists.length == 0) {
                resolve();
            }
            const promise = listGetTasks(
                board.lists[0]._id,
                boardId
            );
            for(let i = 1; i < board.lists.length; i++) {
                promise.then(function() {
                    return listGetTasks(
                        board.lists[i]._id,
                        boardId
                    );
                });
            }
            promise.then(function(res) {
                resolve(res);
            });
            promise.catch(function(error) {
                reject(error);
            });
        })
        .catch(function(error) {
            reject(error);
        });
    });
}

/**
 * Gets the list and renders it on the board
 * @author wize
 * @version 0 (9 Dec 2018)
 * @param {string} listId the list id
 * @param {string} boardId the board id
 * @param {boolean} wipe=false (optional) whether the contents of lists should be wiped out
 * @returns {Promise} a promise to render the list.
 */
function listGetTasks(listId, boardId, wipe=false) {
    return new Promise(function(resolve, reject) {
        doJSONRequest(
            "GET", 
            "/list/" + listId + "/" + boardId,
            {},
            undefined
        )
        .then(function(list) {
            if(wipe) {
                document.getElementById(listId).innerHTML = "";
                // TODO: ADD BUTTON AND TITLE OF LIST
            }
            if(list.tasks.length == 0) {
                resolve();
            }



            let i = 0

            const cb = function(i, length) {
                if(i < length) {
                    taskGet(list.tasks[i], listId, boardId)
                        .then(function(){
                            cb(++i, length)
                        })
                        .catch(reject)
                } else {
                    resolve()
                }
            }
            cb(i, list.tasks.length)
        })
        .catch(function(error) {
            reject(error);
        });
    });
}

/**
 * Gets the task from the server, rendering it in the list
 * if the task exists as DOM object, the DOM object's contents
 * will be updated
 * @author wize
 * @version 0 (9 Dec 2018)
 * @param {string} taskId the id of the task
 * @param {string} listId the id of the list
 * @param {string} boardId the id of the board
 * @returns {Promise} a Promise to render the task
 */
function taskGet(taskId, listId, boardId) {
    return new Promise(function(resolve, reject) {
        doJSONRequest(
            "GET", 
            "/task/" + taskId + "/" + listId + "/" + boardId,
            {},
            undefined
        )
        .then(function(task) {
            dust.render("partials/boardTask", task, function(err, dataOut) {
                if(err) {
                    reject(err); 
                    return;
                }
                let taskDiv;
                if((taskDiv = document.getElementById(taskId)) === null) {
                    taskDiv = document.createElement("div")
                    taskDiv.id = taskId;
                    taskDiv.draggable = true;
                    taskDiv.className = "sticker movable-task";
                    document.getElementById(listId).insertBefore(
                        taskDiv, 
                        document.getElementById(listId).lastChild
                    );

                    let hiddenTask = document.createElement("div");
                    hiddenTask.className = "hidden-task";
                    document.getElementById(listId).insertBefore(
                        hiddenTask, 
                        document.getElementById(listId).lastChild
                    );
                    setColor(taskId);
                }
                taskDiv.innerHTML = dataOut;

                resolve(task);
            });
        })
        .catch(function(error) {
            reject(error);
        });
    });
}
