const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');

const Task = mongoose.model('Task');
const List = mongoose.model('List');
const Board = mongoose.model('Board');

const eventBus = require('../../eventBus');


function checkup(checkedValue, value){

    let forbidden = true;
    
    for(let i = 0; i < checkedValue.length; i++){
        if(checkedValue[i].toString() === value) {
            forbidden = false;
            break;
        }
    }

    return forbidden;
}


//GET METHOD
//Get the task by its id
router.get('/:taskid/:listid/:boardid', function(req, res) {

    let boardId = req.params.boardid;
    let listId = req.params.listid; 
    let taskId = req.params.taskid;
    let aPayload; 
    
    req.auth.then(function(payload) {
        aPayload = payload;        
        /* -- GET THE REQUIRED TASK -- */
        return Task.findById(taskId).exec();
    })
    .then(function(task) {
        /* -- CHECK IF THE USER CAN SEE THIS TASK -- */
        Board.findById(boardId, function(err, boardFound){ 
            if (!err && boardFound){
                List.findById(listId, function(err, listFound){
                    
                    if (!err && listFound){
                        if(checkup(boardFound.users, aPayload._id)) {
                            res.status(403).end(); 
                            return; 
                        }

                        if(checkup(boardFound.lists, listId)) {
                            res.status(403).end(); 
                            return; 
                        }

                        if(checkup(listFound.tasks, taskId)) {
                            res.status(403).end(); 
                            return; 
                        }
                        
                        res.json(task);

                    }else{
                        res.status(400).end();
                    }
                })
            }else{
                res.status(400).end(); 
            } 
        });

        /* -- RETURN THE TASK -- */
        
    })
    .catch(function(error) {
        if(error instanceof Error.DocumentNotFoundError) {
            res.status(404);
        } else {
            res.status(403);
        }
        res.json(error);
    });
});


//GET METHOD
//Get or refresh all the task in the correct columns inside a project
router.get('/', function(req, res) {
    return; 
});

//PUT METHOD
//Move a task into another existing list (Drag and Drop)
router.put('/list', function(req, res) {
    
    let boardId = req.body.boardId;
    let fromListId = req.body.fromListId; 
    let toListId = req.body.toListId; 
    let taskId = req.body.taskId;
    let desiredPosition = req.body.desiredPosition;

    const onSuccess = function() {
        eventBus.emit("LIST.UPDATE", {
            id: boardId,
            boardId: boardId,
            listId: fromListId,
            taskId: taskId,
            wipe: true
        });
        if(fromListId !== toListId) {
            eventBus.emit("LIST.UPDATE", {
                id: boardId,
                boardId: boardId,
                listId: toListId,
                taskId: taskId,
                wipe: true
            });
        }
    }

    req.auth.then(function(payload){
    
        Board.findById(boardId, function(err, boardFound){

            if (!err && boardFound){

                if(checkup(boardFound.users, payload._id)) {
                    res.status(403).end(); 
                    return; 
                }

                if(checkup(boardFound.lists, fromListId)) {
                    res.status(403).end(); 
                    return; 
                }

                if(checkup(boardFound.lists, toListId)) {
                    res.status(403).end(); 
                    return; 
                }

                if (fromListId == toListId){
                    
                    List.findById(fromListId, function(err, listFound1){
                        
                        if (!err && listFound1){

                            if(checkup(listFound1.tasks, taskId)) {
                                res.status(403).end(); 
                                return; 
                            }
                            let listTasks = listFound1.tasks;
                            let idIndex = listTasks.indexOf(taskId);

                            if (desiredPosition > idIndex){
                                desiredPosition--;
                            }

                            listTasks.splice(idIndex, 1);

                            listTasks.splice(desiredPosition, 0, taskId);

                            List.findByIdAndUpdate(fromListId, {tasks:listTasks}, function(err, updated1){
                                if (!err && updated1) {
                                    res.json(updated1).end();
                                    onSuccess();
                                }else{
                                    res.status(500).end();
                                }
                            });

                        }else{
                            res.status(400).end();
                        }
                    })



                }else{
                
                    List.findById(fromListId, function(err, listFound1){
                        
                        if (!err && listFound1){

                            if(checkup(listFound1.tasks, taskId)) {
                                res.status(403).end(); 
                                return; 
                            }
                            
                            List.findById(toListId, function(err, listFound2){

                                if (!err && listFound2){

                                    Task.findById(taskId, function(err, taskFound){
                                        
                                        if (!err && taskFound){

                                            let fromListTasks = listFound1.tasks;
                                            let idIndex = fromListTasks.indexOf(taskId);
                                            fromListTasks.splice(idIndex, 1);

                                            List.findByIdAndUpdate(fromListId, {tasks:fromListTasks}, function(err, updated1){
                                                if (!err && updated1) {
                                                    
                                                    let toListTasks = listFound2.tasks;
                                                    if (checkup(toListTasks, taskId)) {
                                                        toListTasks.splice(desiredPosition, 0, taskId);
                                                    }

                                                    List.findByIdAndUpdate(toListId, {tasks:toListTasks}, function(err, updated2){
                                                        
                                                        if (!err && updated2){
                                                            res.json(updated2); 
                                                            onSuccess();
                                                        }else{
                                                            res.status(500).end();
                                                        }
                                                    });

                                                }else{
                                                    res.status(500).end();
                                                }

                                            }); 


                                        }else{
                                            res.status(400).end(); 
                                        }

                                    });
                                }
                            });

                        }else{
                            res.status(400).end();
                        }
                    });
                }
            }else{
                res.status(400).end();
            }
        }); 

    }).catch(function(error) {
        res.json(error);
    }); 
});

//Modify the name and the description of a specific task
router.put('/:taskid', function(req, res){
    let boardId = req.body.boardId;
    let listId = req.body.listId;
    let taskId = req.params.taskid
    
    let taskName = req.body.taskName; 
    let taskDescription = req.body.taskDescription;
    let taskDueData = req.body.taskDueDate;
    let taskColor = req.body.taskColor;

    let task = {}

    if (taskName){
        task.name = taskName; 
    }
    if (taskDescription){
        task.description = taskDescription; 
    }
    if (taskDueData){
        task.dueDate = new Date(taskDueData); 
    }
    if (taskColor) {
        task.color = taskColor;
    }

    req.auth.then(function(payload){
    
        Board.findById(boardId, function(err, boardFound){

            if (!err && boardFound){

                if(checkup(boardFound.users, payload._id)) {
                    res.status(403).end(); 
                    return; 
                }

                if(checkup(boardFound.lists, listId)) {
                    res.status(403).end(); 
                    return; 
                }
                
                List.findById(listId, function(err, listFound){
                    if (!err && listFound){

                        if(checkup(listFound.tasks, taskId)) {
                            res.status(403).end(); 
                            return; 
                        }

                        Task.findByIdAndUpdate(taskId, task, function(err, updated){

                            if (!err && updated){
                                res.json(updated);
                                eventBus.emit("TASK.UPDATE", {
                                    id: boardId,
                                    taskId: taskId,
                                    listId: listId,
                                    boardId: boardId,
                                    wipe: false,
                                });
                                eventBus.emit("BOT.TASK.UPDATE", {
                                    id: boardId,
                                    boardId: boardId,
                                    listId: listId,
                                    taskId: taskId,
                                    wipe: false,
                                });
                            }else{
                               
                                res.status(400).end(); 
                            } 
                        }); 

                    }else{
                       
                        res.status(400).end();
                    }
                }); 

            }else{
                
                res.status(400).end();
            }
        }); 

    }).catch(function(error) {
        res.json(error);
    }); 

});

//POST METHOD 
//Creat a new task for an existing project
router.post('/', function(req, res) {
    let boardId = req.body.boardId;
    let listId = req.body.listId;
    
    let taskName = req.body.taskName; 
    let taskDescription = req.body.taskDescription;
    let taskColor = req.body.taskColor;

    const task = new Task({
        name: taskName ,
        description: taskDescription,
        color: taskColor
    });

    req.auth.then(function(payload){

        Board.findById(boardId, function(err, boardFound){

            if (!err && boardFound){

                let forbidden = true;
                for(let i = 0; i < boardFound.users.length; i++){
                    if(boardFound.users[i].toString() === payload._id) {
                        forbidden = false;
                        break;
                    }
                }
                if(forbidden) {
                    res.status(403).end(); 
                    return; 
                }
                
                List.findById(listId, function(err, listFound){
                    if (!err && listFound){

                        let forbidden = true;

                        for(let i = 0; i < boardFound.lists.length; i++){
                            if(boardFound.lists[i].toString() === listId) {
                                forbidden = false;
                                break;
                            }
                        }

                        if(forbidden) {
                            res.status(403).end(); 
                            return; 
                        }
                        
                        task.save(function(err, saved) {
                            if (!err && saved) { 

                                listFound.tasks.push(saved._id);
                                let tasks = listFound.tasks;
                                
                                List.findByIdAndUpdate(listId, {tasks:tasks}).then(data => {
                                    res.json(saved); 
                                    eventBus.emit("LIST.UPDATE", {
                                        id: boardId,
                                        boardId: boardId,
                                        listId: listId,
                                        taskId: saved._id,
                                        wipe: false,
                                    });
                                    eventBus.emit("BOT.TASK.CREATE", {
                                        id: boardId,
                                        boardId: boardId,
                                        listId: listId,
                                        taskId: saved._id,
                                        wipe: false,
                                    });
                                }); 
                                
                            } else {
                                res.status(400).end();
                            }
                        });

                    }else{
                        res.status(400).end();
                    }
                });
            }else{
                res.status(400).end();
            }
        }); 

    }).catch(function(error) {
        res.json(error);
    }); 
});

//DELETE METHOD
//Delete a specific task in an existing project
router.delete('/:boardid/:listid/:taskid', function(req, res) {


    let boardId = req.params.boardid;
    let listId = req.params.listid;
    let taskId = req.params.taskid; 

    req.auth.then(function(payload) {

        Board.findById(boardId, function(err, boardFound){

            if (!err && boardFound){

                    let forbidden = true;
                    for(let i = 0; i < boardFound.users.length; i++){
                        if(boardFound.users[i].toString() === payload._id) {
                            forbidden = false;
                            break;
                        }
                    }
                    if(forbidden) {
                        res.status(403).end(); 
                        return; 
                    }
                
                List.findById(listId, function(err, listFounded){
                    if (!err && listFounded){

                        let forbidden = true;
                        for(let i = 0; i < boardFound.lists.length; i++){
                        if(boardFound.lists[i].toString() === listId) {
                            forbidden = false;
                            break;
                            }
                        }

                        if(forbidden) {
                            res.status(403).end(); 
                            return; 
                        }

                        Task.findById(taskId, function(err, taskFounded) {
                            if (!err && taskFounded) { 

                                let forbidden = true;
                                for(let i = 0; i < listFounded.tasks.length; i++){
                                    if(listFounded.tasks[i].toString() === taskId) {
                                        forbidden = false;
                                        break;
                                    }
                                }
                        
                                if(forbidden) {
                                    res.status(403).end(); 
                                    return; 
                                }
                                
                                let tasks = listFounded.tasks;
                                let idIndex = tasks.indexOf(taskId);
                                tasks.splice(idIndex, 1);

                                //Delete the task id
                                List.findByIdAndUpdate(listId, {tasks:tasks}).then(() => {

                                    taskFounded.remove(function (err, removed) {
                                        if (!err) {
                                            res.json(removed);
                                            eventBus.emit("LIST.UPDATE", {
                                                id: boardId,
                                                taskId: taskId,
                                                listId: listId,
                                                boardId: boardId,
                                                wipe: true,
                                            });
                                            eventBus.emit("BOT.TASK.DELETE", {
                                                id: boardId,
                                                boardId: boardId,
                                                listId: listId,
                                                taskId: taskId,
                                                wipe: false,
                                            });
                                        } else {
                                            res.status(400).end();
                                        }
                                    });
                                });  
                            } else {
                                res.status(400).end();
                            }
                        });
                    }else{
                        res.status(400).end();
                    }
                });
            }else{
                res.status(400).end();
            }
        }); 

    }).catch(function(error) {
        res.json(error);
    });
}); 


module.exports = router;
