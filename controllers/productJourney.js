const async = require("async");
const ProjectJourneyModel = require("../models/productJourney");

var ProductJourneyController = {};

/**
 
 * @api {post} productJourney/getJourneyData  websocket: Method get product journey data
 * @apiName getJourneyData.
 * @apiGroup Product Journey
 * 
 * @apiDescription steps
 *1. Actually this is not the api. It is a method which is called by websocket file to get product 
    journey data.
 * 
 * @apiParam {String} productJourneyId _id of product journey.
 * 
 * @apiSuccess {Object} data productJourney data 
 * 
 * @apiError mongooseError Syntax error during applying query of mongodb.
 * @apiError NotFound productJourneyId not exist in db.
 * 
 * @apiErrorExample Response (example):
 *     HTTP/1.1 500 mongooseError
 *     {
 *        "msg": "mongooseError",
 *         "status": "500"
 *     }
 * @apiErrorExample NotFound :
 *     HTTP/1.1 404 NotFound
 *     {
 *        "msg": "NotFound",
 *         "status": "404"
 *     }
 */
ProductJourneyController.getJourneyData = (req, callback)=>{
    // console.log('getJourneyData ', req)
    ProjectJourneyModel.findOne({_id : req.productJourneyId}, (err, data)=>{
        if(err){
            callback({status:500, err:err});
        }
        else if(data){
            callback(null, data);
        }
        else{
            callback({status:404, err:"Not Found!"});
        }
    })
}
/**
 
 * @api {post} productJourney/getProjectJourneyData  websocket: Method get assigned tasks of a user
 * @apiName getProjectJourneyData.
 * @apiGroup Product Journey
 * 
 * @apiDescription steps
 *1. Actually this is not the api. It is a method which is called by websocket file to get total assign
    tasks of a user.
 * 
 * @apiParam {String} userId userId of user.
 * 
 * @apiSuccess {Array} assignTasks List of task which is assigned to the user. 
 * 
 * @apiError mongooseError Syntax error during applying query of mongodb.
 * 
 * @apiErrorExample Response (example):
 *     HTTP/1.1 500 mongooseError
 *     {
 *        "msg": "mongooseError",
 *         "status": "500"
 *     }
 */
ProductJourneyController.getProjectJourneyData = (req, mainCallback)=>{
    // console.log('getProjectJourneyData = ',req);
    let assignTasks=[];
    let condition = {
        // projectId:req.projectId,
        "thingsToDo.tasks.ownerShip.userId":req.userId
    }
    ProjectJourneyModel.find(condition,(err, data)=>{
        if(err){
            // res.status(500).send({err:err});
            mainCallback({err:err});
        }
        else if(data.length>0){
            console.log('data.length = ', data.length)
            async.forEachSeries(data, (pJData, pJCallback)=>{
                async.forEachSeries(pJData.thingsToDo,(tTData, tTCallback)=>{
                    async.forEachSeries(tTData.tasks, (taskData,taskCallback)=>{
                        // console.log('taskData.userId , ', taskData.userId)
                        if(taskData.ownerShip.userId===req.userId){
                            assignTasks.push({
                                taskId:taskData._id,
                                workingStatus:taskData.workingStatus,
                                timerValue:taskData.hoursSpent,
                                projectId:pJData.projectId,
                                stageId:tTData._id
                            });
                            taskCallback();
                        }
                        else{
                            taskCallback();
                        }
                    }, err=>{
                        tTCallback();
                    });
                }, err=>{
                    pJCallback();
                });
            }, err=>{
                // res.status(200).send({data:assignTasks});
                // console.log('assignTasks ', assignTasks);
                mainCallback(null, assignTasks);
            })
            
        }
        else{
            mainCallback(null, assignTasks);
        }
    })
}
/**
 
 * @api {post} productJourney/sendInfoToOnlineUsers  websocket: Method update the working status of offline user 
 * @apiName sendInfoToOnlineUsers.
 * @apiGroup Product Journey
 * 
 * @apiDescription steps
 *1. Actually this is not the api. It is a method which is called by websocket file to update the wokring 
 *   status stop when a user goes offline or lost the internet connection.
 * 
 * @apiParam {String} onlineUserId onlineUserId of user.
 * @apiParam {Object} offlineUser Object of offlineUser.
 * 
 * @apiSuccess {Object} pJData productJourney data . 
 * 
 * @apiError mongooseError Syntax error during applying query of mongodb.
 * 
 * @apiErrorExample Response (example):
 *     HTTP/1.1 500 mongooseError
 *     {
 *        "msg": "mongooseError",
 *         "status": "500"
 *     }
 */
ProductJourneyController.sendInfoToOnlineUsers = (offlineUser,onlineUserId, mainCallback)=>{
    // console.log("offline user------->",offlineUser)
    if(offlineUser && (offlineUser.userType==='DL' || offlineUser.userType==='DP')){
        ProductJourneyController.updateOffLineStatus(onlineUserId, (err, offlineUpdate)=>{
            if(err){
                console.log('err in sendInfoToOnlineUsers 1', err)
                mainCallback("ok");
            }
            else if(offlineUpdate){
                console.log('offlineUpdate taskId = ', offlineUpdate.productJourneyId);
                ProductJourneyController.getJourneyData(offlineUpdate, (err, pJData)=>{
                    if(err){
                        console.log('err in sendInfoToOnlineUsers 2', err)
                        mainCallback("ok");
                    }
                    else{
                        mainCallback(null, pJData);
                    }
                });
            }
            else{
                console.log('only user come');
                mainCallback(null,null);
            }
        });
    }
    else{
        console.log('err in sendInfoToOnlineUsers 3')
        mainCallback("ok");
    }
}
ProductJourneyController.updateOffLineStatus = (onlineUserId, callback)=>{
    console.log("updateOffLineStatus");
    let condition1 = {
        // "thingsToDo.tasks.ownerShip.userId":onlineUserId,
        "thingsToDo.tasks":{"$elemMatch":{"ownerShip.userId":onlineUserId,workingStatus:"working"}}
    }
    ProjectJourneyModel.find(condition1,(err, ownerShipFind)=>{
        if(err){
            // res.status(500).send({err:err});
            callback(err);
        }
        else if(ownerShipFind.length>0){
            console.log('finded dp offline ', ownerShipFind.length)
            // res.status(500).send({data:ownerShipFind});
            let taskId = "", productJourneyId="";
            let thingsCount=0, taskCount=0, finalCount=0;
            async.forEachSeries(ownerShipFind, (journeyData, journeyCallback)=>{
                thingsCount=0, taskCount=0;
                async.forEachSeries(journeyData.thingsToDo, (thingsData, thingsCallback)=>{
                    taskCount=0;
                    async.forEachSeries(thingsData.tasks, (taskData, taskCallback)=>{
                        if(taskData.ownerShip.userId===onlineUserId && taskData.workingStatus==='working'){
                            console.log('taskCount = ', taskCount, taskData._id)
                            productJourneyId=journeyData._id;                            
                            ProductJourneyController.updateInTaskOwnerShip(
                                finalCount,
                                thingsCount, 
                                taskCount, 
                                condition1,
                                ownerShipFind,
                                (err, updateOwnership)=>{
                                    if(err){
                                        console.log('err in updateInTaskOwnerShip', err);
                                        taskCount++;
                                        taskCallback();
                                        
                                    }
                                    else{
                                        taskCount++;
                                        taskCallback(true);
                                    }
                                })
                        }
                        else{
                            taskCount++;
                            taskCallback();
                        }
                    }, taskErr =>{
                        if(taskErr){
                            thingsCallback(true);
                        }
                        else{
                            thingsCount++;
                            thingsCallback();
                        }
                    })
                }, thingsErr=>{
                    if(thingsErr){
                        journeyCallback(true);
                    }
                    else{
                        finalCount++;
                        journeyCallback();
                    }
                });
            }, journeyError=>{
                // res.status(200).send({data:"updated"});
                callback(null,{productJourneyId:productJourneyId});
            });
        }
        else{
            callback(null, null);
        }
    })
}

ProductJourneyController.updateInTaskOwnerShip = (finalCount, thingsCount, tasksCount, condition1,ownerShipFind, callback)=>{

    console.log('updated offline dp status', finalCount, thingsCount, tasksCount)
    ownerShipFind[finalCount].thingsToDo[thingsCount].tasks[tasksCount].workingStatus='stop';
    ownerShipFind[finalCount].save((err, data)=>{
        if(err){
            console.log('err in saving updateInTaskOwnerShip', err);
            callback(err);
        }
        else{
            callback(null, 'ok');
        }
    })
}





//<------------api hiting directly from postman--------------->

ProductJourneyController.getJourneyData1 = (_req, res)=>{
    let req = _req.body
    ProjectJourneyModel.findOne({_id : req.productJourneyId}, (err, data)=>{
        if(err){
            // callback({status:500, err:err});
            res.send({status:500,err:err});
        }
        else if(data){
            // callback(null, {data:data});
            res.send({status:200, data:data});
        }
        else{
            // callback({status:404, err:"Not Found!"});
            res.send({status:404, err:"Not Found!"});
        }
    })
}
ProductJourneyController.getProjectJourneyData1 = (req, res)=>{
    let condition = {
        // projectId:req.body.projectId,
        "thingsToDo.tasks.ownerShip.userId":req.body.userId
    }
    ProjectJourneyModel.find(condition,(err, data)=>{
        if(err){
            res.status(500).send({err:err});
        }
        else{
            let assignTasks=[];
            console.log('data.length = ', data.length)
            async.forEachSeries(data, (pJData, pJCallback)=>{
                async.forEachSeries(pJData.thingsToDo,(tTData, tTCallback)=>{
                    async.forEachSeries(tTData.tasks, (taskData,taskCallback)=>{
                        // console.log('taskData.userId , ', taskData.userId)
                        if(taskData.ownerShip.userId===req.body.userId){

                            assignTasks.push({
                                taskId:taskData._id,
                                workingStatus:taskData.workingStatus
                            });
                            taskCallback();
                        }
                        else{
                            taskCallback();
                        }
                    }, err=>{
                        tTCallback();
                    });
                }, err=>{
                    pJCallback();
                });
            }, err=>{
                res.status(200).send({data:assignTasks});
            })
            
        }
    })
}
ProductJourneyController.updateOffLineStatus1 = (req, res)=>{

    let onlineUserId = req.body.offlineUserId;
    let condition1 = {
        "thingsToDo.tasks.ownerShip.userId":onlineUserId
    }
    ProjectJourneyModel.find(condition1,(err, ownerShipFind)=>{
        if(err){
            res.status(500).send({err:err});
        }
        else{
            // res.status(500).send({data:ownerShipFind});
            console.log('finded dp offline ', ownerShipFind.length)

            let thingsCount=0, taskCount=0, finalCount=0;
            async.forEachSeries(ownerShipFind, (journeyData, journeyCallback)=>{
                thingsCount=0, taskCount=0;
                async.forEachSeries(journeyData.thingsToDo, (thingsData, thingsCallback)=>{
                    taskCount=0;
                    async.forEachSeries(thingsData.tasks, (taskData, taskCallback)=>{
                        if(taskData.ownerShip.userId===onlineUserId){
                            console.log('taskCount = ', taskCount, taskData._id)
                            ProductJourneyController.updateInTaskOwnerShip(
                                finalCount,
                                thingsCount, 
                                taskCount, 
                                condition1,
                                ownerShipFind,
                                (err, updateOwnership)=>{
                                    if(err){
                                        console.log('err in updateInTaskOwnerShip', err);
                                        taskCount++;
                                        taskCallback();
                                    }
                                    else{
                                        taskCount++;
                                        taskCallback();
                                        
                                    }
                                })
                            }
                            else{
                                taskCount++;
                                taskCallback();
                            }
                        }, taskErr =>{
                            if(taskErr){
                                thingsCallback(true);
                            }
                            else{
                                thingsCount++;
                                thingsCallback();
                            }
                        })
                    }, thingsErr=>{
                        if(thingsErr){
                            journeyCallback(true);
                        }
                        else{
                            finalCount++;
                            journeyCallback();
                        }
                    });
            }, journeyError=>{
                res.status(200).send({data:"updated"});
            });
        }
    });
}
module.exports = ProductJourneyController;

