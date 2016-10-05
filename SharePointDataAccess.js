define(['angular', 'jquery', 'moment', 'log', 'spservices', 'camljs'], function(angular, $, moment, log) {
	angular
		.module('spDataAccess', [])
		.factory('spDataAccess', spDataAccess);

	spDataAccess.$inject = ['$q'];	
	function spDataAccess($q){		
		'use strict'
		var _siteUrl;
		var choiceCache = {};
		var ensuredUserCacheObj = {};
		var WORKFLOW_STATE = {
			None: 0,
			Locked: 1,
			Running: 2,
			Completed: 4,
			Cancelled: 8,
			Expiring: 16,
			Expired: 32, 
			Faulting: 64,
			Terminated: 128,
			Suspended: 256,
			Orphaned: 512,
			HasNewEvents: 1024,
			NotStarted: 2048,
			All: 4095
		};

		return {
			addEnsuredUserToCache: addEnsuredUserToCache,
			addUserToGroup : addUserToGroup,
			checkInFile: checkInFile,
			csomToJson: csomToJson,
			createDocumentSet: createDocumentSet,			
			createGroup : createGroup,
			createListItem : createListItem,
			createListItemInFolder : createListItemInFolder,
			deleteListItemById: deleteListItemById,
			ensureFolder : ensureFolder,
			ensureUsers: ensureUsers,
			getAllItemsInFolder: getAllItemsInFolder,
			getAllListItems: getAllListItems,
			getAllListItemsWithBatchedQueries: getAllListItemsWithBatchedQueries,
			getAllListItemsWithPaging: getAllListItemsWithPaging,
			getChoiceFieldChoices: getChoiceFieldChoices,
			getContentTypesInList: getContentTypesInList,
			getCtx: getCtx,
			getCurrentUser: getCurrentUser,
			getFieldsInList: getFieldsInList,
			getGroup : getGroup,
			getGroupMembers: getGroupMembers,
			getLibraryItemByFileLeafRef: getLibraryItemByFileLeafRef,
			getListItemById : getListItemById,
			getListItemByIdWithCaching : getListItemByIdWithCaching,
			getListItemsByIds: getListItemsByIds,
			getListItemsByLookup : getListItemsByLookup,
			getListItemsByTextField: getListItemsByTextField,
			getUserPermissionsOnList: getUserPermissionsOnList,
			getViewFieldCamlFromFieldArray: getViewFieldCamlFromFieldArray,
			getWorkflowTemplatesForItem: getWorkflowTemplatesForItem,			
			getWorkflowsForItem: getWorkflowsForItem,
			isGroupMember : isGroupMemberCSOM,
			preCacheChoiceFieldChoices: preCacheChoiceFieldChoices,
			removeUserFromGroup : removeUserFromGroup,
			startWorkflow: startWorkflow,
			testConnection: testConnection,
			updateListItem: updateListItem,
			upload: upload
		}
		
		function siteUrl(){
			if (!_siteUrl){
				_siteUrl = ($().SPServices.SPGetCurrentSite() + "/").replace(/^(?:\/\/|[^\/]+)*\//, "/");			
			}
			
			return _siteUrl;
		}
		
		var _ctx = null;
		function getCtx(){
			return new SP.ClientContext(siteUrl());
		}

		function executeQueryAsync(ctx, ret){
			return $q(function(resolve, reject){
				ctx.executeQueryAsync(Function.createDelegate(this, function() {					
					resolve(ret);
				}), Function.createDelegate(this, function(sender, args) {
					reject(args);
				}));
			});
		}
		
		function testConnection(){
			var ctx = getCtx();
			var web = ctx.get_web();
			ctx.load(web);
			return executeQueryAsync(ctx, {success: true}).then(function(result){
				return result;
			}, function(args){
				return $q.reject({success: false, args: args});
			});
		}
	
		function getFieldsInList(listName){
		
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var list = clientContext.get_web().get_lists().getByTitle(listName);
				var listFields = list.get_fields();
				clientContext.load(listFields, 'Include(Title,InternalName,Description,FieldTypeKind,TypeAsString,Hidden)');
			    clientContext.executeQueryAsync(Function.createDelegate(this, function(){
				   	var fields = {};
			        var fieldEnumerator = listFields.getEnumerator();
			        while (fieldEnumerator.moveNext()) {
			            var oField = fieldEnumerator.get_current();
			        	if (oField.get_fieldTypeKind() == 28) {//WorkflowStatus
			        		continue;
			        	}
						switch (oField.get_internalName()){
							case 'ContentType': 
							case 'PermMask':
							case 'LinkCheckedOutTitle':
							case '_EditMenuTableStart':
							case '_EditMenuTableStart2':						
							case '_EditMenuTableEnd':
							case 'LinkFilenameNoMenu':
							case 'LinkFilename':
							case 'LinkFilename2':
							case 'DocIcon':
							case 'ServerUrl':
							case 'EncodedAbsUrl':	
							case 'BaseName':
							case 'FileSizeDisplay':
							case 'SelectTitle':	
							case 'SelectFilename':
							case 'Edit':
							case 'Combine':
							case 'RepairDocument':
							case '_Level':
							case '_IsCurrentVersion':
							case '_UIVersion': 
							case 'FSObjType':	
							case '_UIVersionString':
							case 'Order':
							case 'GUID':
							case 'WorkflowVersion':
							case 'ParentVersionString':
							case 'ParentLeafName':
							case 'HTML_x0020_File_x0020_Type':
							case 'File_x0020_Size':
							case 'SortBehavior':							
							case 'IsCheckedoutToLocal':
							case 'UniqueId':
							case 'SyncClientId':
							case 'ProgId':
							case 'ScopeId':
							case 'VirusStatus':
							case 'CheckedOutTitle':
							case 'CheckinComment':
							case '_CheckinComment':
							case 'MetaInfo':
							case 'DocConcurrencyNumber':
								break;
							default: 
					            fields[oField.get_internalName()] = {
					            	title: oField.get_title(),
					            	internalName: oField.get_internalName(),
					            	description: oField.get_description(),
					            	typeAsString: oField.get_typeAsString(),
					            	type: oField.get_fieldTypeKind(),
					            	hidden: oField.get_hidden()
					            };
					        break;
					 	}			         
			        }
			        
			        deferred.resolve(fields);
			    }),	Function.createDelegate(this, function(sender, args){
			    	deferred.reject(args.get_message());		    
			    }));
	
	   		} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
		
		function getContentTypesInList(listName){
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				var contentTypes = oList.get_contentTypes();
				clientContext.load(contentTypes);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							var ret = {};
							var ctEnum = contentTypes.getEnumerator();
							while (ctEnum.moveNext()){
								var ct = ctEnum.get_current();
								ret[ct.get_id().toString()] = {
									name: ct.get_name(),
									templateUrl: ct.get_documentTemplateUrl(),
									id: ct.get_id().toString(),
									workflows: []
								}
								
								clientContext.load(ct.get_workflowAssociations());
							}
							clientContext.executeQueryAsync(Function.createDelegate(this,
									function() {
										var ctEnum = contentTypes.getEnumerator();
										while (ctEnum.moveNext()){
											var ct = ctEnum.get_current();
											var wfEnum = ct.get_workflowAssociations().getEnumerator();
											while (wfEnum.moveNext()){
												var wf = wfEnum.get_current();
												if (wf.get_allowManual()){
													ret[ct.get_id()].workflows.push({
														name: wf.get_name(),
														id: wf.get_id()								
													});						
												}		
											}
											var sorted = ret[ct.get_id()].workflows.sort(function(a, b){
												if(a.name < b.name) return -1;
											    if(a.name > b.name) return 1;
											    return 0;
											});
											ret[ct.get_id()].workflows = sorted;
										}
										deferred.resolve(ret);
									}), Function.createDelegate(this, function(sender, args) {
										deferred.reject({message: "dataAccess.getWorkflowsFromObject:" + args.get_message()})
									}));
	
						}), Function.createDelegate(this, function(sender, args) {
							deferred.reject({message: "dataAccess.getContentTypesInList:" + args.get_message()})
						}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;		
		}
	
		function createListItem(listName, obj) {
			return $q(function(resolve, reject){
				try {
					var clientContext = getCtx();
					var oList = clientContext.get_web().get_lists()
							.getByTitle(listName);
		
					var itemCreateInfo = new SP.ListItemCreationInformation();
					this.oListItem = oList.addItem(itemCreateInfo);
		
					jsonToCsom(obj, this.oListItem);
		
					this.oListItem.update();
		
					clientContext.load(this.oListItem);
					clientContext.executeQueryAsync(Function.createDelegate(this,
							function() {
								obj.ID = this.oListItem.get_id();
								resolve(this.oListItem, obj);
							}), Function.createDelegate(this, function(sender, args) {
								reject({message: "dataAccess.createListItem:" + args.get_message()})
							}));
				} catch (err) {
					reject(err);
				}

			});
		}
		
		//Todo: Return updated fields maybe? Check to see if someone else is working on item maybe? Call me maybe?
		function updateListItem(listName, obj, fields) {
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				var listItem = oList.getItemById(obj.ID);
				
				jsonToCsom(obj, listItem, fields);
				listItem.update();
	
				clientContext.load(listItem);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItem);
						}), Function.createDelegate(this, function(sender, args) {
							deferred.reject(args);
						}));
	
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		function checkInFile(listName, id){
			var ctx = getCtx();
			var list = ctx.get_web().get_lists().getByTitle(listName);
			var file = list.getItemById(id).get_file();
			file.checkIn("Checked in by JavaScript", 1);
			ctx.load(file);
			return executeQueryAsync(ctx, id).catch(function(args){
				if (args.get_message().indexOf('is not checked out') != -1){
					log.info("File was not checked out")
					return $q.when();
				} else {
					return $q.reject(args);
				}
			});
		}

		function createDocumentSet(listName, obj, fields, optionalDocumentSetContentTypeId){
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists().getByTitle(listName);
				var rootFolder = oList.get_rootFolder();
				var itemCreateInfo = new SP.ListItemCreationInformation();
				itemCreateInfo.set_underlyingObjectType(SP.FileSystemObjectType.folder);
				itemCreateInfo.set_leafName(obj['FileLeafRef']);			
	
				this.oListItem = oList.addItem(itemCreateInfo);
				var docSetContentTypeID = optionalDocumentSetContentTypeId || "0x0120D520";
	
				this.oListItem.set_item("ContentTypeId", docSetContentTypeID);
	
				jsonToCsom(obj, this.oListItem, fields);
							
				this.oListItem.update();
				clientContext.load(this.oListItem);
				clientContext.load(rootFolder);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {			
							log.info("Doc Set Created");						    
						    deferred.resolve(this.oListItem);
						}), Function.createDelegate(this, function(sender, args) {
							log.error("Doc Set Creation Error" +  args.get_message());
							deferred.reject(args)
						}));
			
			
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;	
		}
	
		function getChoiceFieldChoices(listName, fieldName){
			var deferred = $q.defer();
	
			try {
				if (choiceCache[listName] && choiceCache[listName][fieldName]){
					deferred.resolve(choiceCache[listName][fieldName]);
				} else {
					var ctx = new SP.ClientContext(siteUrl());
					var list = ctx.get_web().get_lists().getByTitle(listName);
					this.choiceField = ctx.castTo(list.get_fields().getByInternalNameOrTitle(fieldName), SP.FieldChoice);
					ctx.load(this.choiceField);
		
					ctx.executeQueryAsync(Function.createDelegate(this,
							function() {		
								try {
									var choices = this.choiceField.get_choices();
									if (!choiceCache[listName]){
										choiceCache[listName] = {};
									}
									choiceCache[listName][fieldName] = choices 
					    			deferred.resolve(choices);
				    			} catch(err){
				    				deferred.reject(err);
				    			}
				    		}), Function.createDelegate(this, function(sender, args) {
								deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + args.get_message()})
							}));
				}
	   		} catch (err) {
	   			debugger;
				deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + err.message});
			}
	
			return deferred.promise;	
		}
		
		function preCacheChoiceFieldChoices(listName, fieldNames){
			var deferred = $q.defer();
			try {
				var ctx = new SP.ClientContext(siteUrl());
				var list = ctx.get_web().get_lists().getByTitle(listName);
				var fields = [];
				for (var index in fieldNames){				
					var choiceField = ctx.castTo(list.get_fields().getByInternalNameOrTitle(fieldNames[index]), SP.FieldChoice);				
					fields.push(choiceField);
					ctx.load(choiceField);
				}
	
				ctx.executeQueryAsync(Function.createDelegate(this,
						function() {
							try {
								if (!choiceCache[listName]){
									choiceCache[listName] = {};
								}
		
								for (var index in fields){
									try {
										var choiceField = fields[index];
										choiceCache[listName][choiceField.get_internalName()] = choiceField.get_choices();													
									} catch(err){
										throw "Problem getting field " + fields[index].get_internalName() + ": " + err.message;
									}
								}						
		
				    			deferred.resolve(choiceCache);
				    		} catch(err){
				    			deferred.reject(err);
				    		}
			    		}), Function.createDelegate(this, function(sender, args) {
			    			debugger;
							deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + args.get_message()})
						}));
	   		} catch (err) {
	   			debugger;
				deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + err.message});
			}
	
			return deferred.promise;	
		}
		
		function getListItemById(listName, id) {
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				var listItem = oList.getItemById(id);
	
				clientContext.load(listItem);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItem);
						}), Function.createDelegate(this, function(sender, args) {
							deferred.reject(args);
						}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
		
		function getListItemsByIds(listName, idArr, include) {
			var deferred = $q.defer();
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
	
				var camlStr = new CamlBuilder().View(include).Scope(1).Query().Where().CounterField('ID').In(idArr).ToString();
	
				var camlQuery = SP.CamlQuery.createAllItemsQuery();
				camlQuery.set_viewXml(camlStr);
							
				var listItems = oList.getItems(camlQuery);
	
				clientContext.load(listItems);
				
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItems);
						}), Function.createDelegate(this, function(sender, args) {
							deferred.reject(args);
						}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		
		function getLibraryItemByFileLeafRef(listName, fileLeafRef){
			var deferred = $q.defer();
			if (!fileLeafRef){
				deferred.resolve(0);
			} else {
				try {
					var clientContext = getCtx();
					var oList = clientContext.get_web().get_lists().getByTitle(listName);
					var query = new SP.CamlQuery();
						query.set_viewXml("<View Scope='RecursiveAll'>" +
			                  "<Query>" +
			                    "<Where>" +
		                        "<Eq>" +
		                          "<FieldRef Name='FileLeafRef'/>" +
		                          "<Value Type='Text'>" + fileLeafRef + "</Value>" +
		                        "</Eq>" +
			                    "</Where>" +
			                  "</Query>" +
			                "</View>");
					this.items = oList.getItems(query);
					clientContext.load(this.items);
					clientContext.executeQueryAsync(Function.createDelegate(this,
							function() {
								var listEnumerator = this.items.getEnumerator();
								if (listEnumerator.moveNext()){
									deferred.resolve(listEnumerator.get_current().get_id());
								} else {							
									deferred.resolve(0);
								}
							}), Function.createDelegate(this, function(sender, args) {
								deferred.reject(args);
							}));
				} catch (err) {
					deferred.reject(err);
				}
			}
	
			return deferred.promise;
		}
	
		function getListItemByIdWithCaching(listName, id) {
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				var listItem = oList.getItemById(id);
	
				clientContext.load(listItem);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItem);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
			return deferred.promise;
		}
	
		function createListItemInFolder(listName, obj, folderPath) {
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
	
				var itemCreateInfo = new SP.ListItemCreationInformation();
				itemCreateInfo.set_folderUrl(folderPath);
				this.oListItem = oList.addItem(itemCreateInfo);
	
				for (var key in obj) {
					this.oListItem.set_item(key, obj[key]);
				}
	
				this.oListItem.update();
	
				clientContext.load(this.oListItem);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(this.oListItem);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
		
		function deleteListItemById(listName, id) {
			return $q(function(resolve, reject){
				try {
					var clientContext = getCtx();
					var oList = clientContext.get_web().get_lists()
							.getByTitle(listName);
					var listItem = oList.getItemById(id);
					listItem.deleteObject();
		
					clientContext.executeQueryAsync(Function.createDelegate(this,
							function() {
								resolve();
							}), Function.createDelegate(this, function(sender, args) {
						reject(args);
					}));
				} catch (err) {
					reject(err);
				}
			})
		}

		function createGroup(siteUrl, groupName, description) {
			var deferred = $q.defer();
	
			try {
				var clientContext = new SP.ClientContext(siteUrl()).replace(/^(?:\/\/|[^\/]+)*\//, "/");
				this.oWebsite = clientContext.get_web();
	
				var groupCreationInfo = new SP.GroupCreationInformation();
				groupCreationInfo.set_title(groupName);
				groupCreationInfo.set_description(description);
				this.oGroup = this.oWebsite.get_siteGroups().add(groupCreationInfo);
	
				clientContext.load(this.oGroup);
	
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(this.oGroup);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}

		function executeQueryAsync(ctx, resolveValue){
			return $q(function(resolve,reject){ctx.executeQueryAsync(Function.createDelegate(this,function() {
				resolve(resolveValue);
			}), Function.createDelegate(this, function(sender, args) {
				reject(args);
			}))})
		}
		
		function getCurrentUser(){
			var deferred = $q.defer();
	
			try {
				var ctx = new SP.ClientContext(siteUrl());
				var user = ctx.get_web().get_currentUser();
				ctx.load(user);
				ctx.executeQueryAsync(function () {			
			    	var ret = {
			    		id: user.get_id(),
			    		username: user.get_title(),
			    		email: user.get_email()
			    	}
			    	deferred.resolve(ret);
			    }, function(err){
			    	deferred.reject(err)
			    });
	   		} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
		
	
	
		function isGroupMemberSync(groupName, userLoginName) {
			var isGroupMember = false;
			if (typeof userLoginName == 'undefined') {
				userLoginName = $().SPServices.SPGetCurrentUser();
			}
			$().SPServices({
				operation : "GetGroupCollectionFromUser",
				userLoginName : $().SPServices.SPGetCurrentUser(),
				async : false,
				completefunc : function(xData, Status) {
					if ($(xData.responseXML).find(
							"Group[Name='" + groupName + "']").length == 1) {
						isGroupMember = true;
					}
				}
			});
	
			return isGroupMember;
		}
	
		function isGroupMemberCSOM(groupId){
			return $q(function(resolve, reject){
				try {
					var ctx = new SP.ClientContext(siteUrl());
		
					var web = ctx.get_web();
				 	var user = web.get_currentUser();
				 	var group = web.get_siteGroups().getById(groupId);
				 	var groupUsers = group.get_users();
				    ctx.load(user);
				    ctx.load(groupUsers);
				    ctx.executeQueryAsync(
		                function(sender, args) {
							var userInGroup = false;
							var enumerator = groupUsers.getEnumerator();
							while (enumerator.moveNext()){
								var currUser = enumerator.get_current();
								if (currUser.get_id() == user.get_id()){
									userInGroup = true;
									break;
								}
							}
							
							resolve(userInGroup);
		                },
		                function OnFailure(sender, args) {
		                	switch(args.get_errorCode()){
		                		case -2147024891: //UnauthorizedAccessException
		                			resolve(false);
		                			break;
		                		default: 
									reject(args);
									break;
		                	}
		                }
			        );
				} catch (err) {
					reject(err);
				}
			});
		}
		
		function getUserPermissionsOnList(listName){
			var deferred = $q.defer();
	
			try {
				var ctx = getCtx();
				
				var web = ctx.get_web();
				var oList = ctx.get_web().get_lists()
						.getByTitle(listName);
	
				ctx.load(oList, 'EffectiveBasePermissions');
				ctx.executeQueryAsync(function () {						
					var perms = oList.get_effectiveBasePermissions();
			    	deferred.resolve({
						add: perms.has(SP.PermissionKind.addListItems),
						edit: perms.has(SP.PermissionKind.editListItems),
						view: perms.has(SP.PermissionKind.viewListItems),
						del: perms.has(SP.PermissionKind.deleteListItems),
					});
			    }, function(err){
			    	deferred.resolve({
			    		add: false,
			    		edit: false,
			    		view: false,
			    		del: false
			    	});
			    	deferred.reject(err)
			    });
				
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;	
		}

		function getGroup(strGroupName) {
			function GetAllGroupsExecuteOnSuccess(sender, args) {
		
				// CHECK THE GROUPS
				// Time to Enumerate through the group collection that was
				// returned.
				var groupEnumerator = allGroups.getEnumerator();
		
				// Loop for the collection.
				while (groupEnumerator.moveNext()) {
		
					// Grab the Group Item.
					var group = groupEnumerator.get_current();
					if (group.get_title().indexOf(strGroupName) > -1) {
						deferred.resolve(currentContext, group);
						return;
					}
				}
				deferred.resolve(null);
			}
	
			var deferred = $q.defer();
	
			try {
				// Setup Vars
				currentContext = null;
				currentWeb = null;
				allGroups = null;
				leaderGroup = null;
				// groupUsers = null;
	
				// Get an instance of the Client Content.
				currentContext = new SP.ClientContext.get_current();
	
				// Grab the client web object.
				currentWeb = currentContext.get_web();
	
				// Setup the groupColletion.
				allGroups = currentWeb.get_siteGroups();
				currentContext.load(allGroups, 'Include(Title, Id)');
	
				// Now populate the objects above.
				currentContext.executeQueryAsync(Function.createDelegate(this,
						GetAllGroupsExecuteOnSuccess), function() {
					deferred.resolve(null);
				});
	
				// GroupCollection - Load - SUCCESS
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}

		function getGroupMembers(groupId){
			var ctx = getCtx();
			var groupCollection = ctx.get_web().get_siteGroups();
			var group = groupCollection.getById(groupId);
			var users = group.get_users();
			ctx.load(users);

			return executeQueryAsync(ctx, users).then(function(_users){
				var ret = [];
				var enumerator = _users.getEnumerator();
				while(enumerator.moveNext()){
					ret.push(enumerator.get_current().get_id());
				}

				return ret;
			});
		}
	
		function addUserToGroup(groupName, currUser) {
			var deferred = $q.defer();
	
			try {
	
				if (typeof currUser == 'undefined')
					currUser = $().SPServices.SPGetCurrentUser();
				GetGroup(groupName, function(clientContext, group) {
					var userCreationInfo = new SP.UserCreationInformation();
					userCreationInfo.set_loginName(currUser);
					group.get_users().add(userCreationInfo);
					clientContext.executeQueryAsync(Function.createDelegate(this,
							deferred.resolve), Function.createDelegate(this,
							function(sender, args) {
								deferred.reject('Request failed. '
										+ args.get_message() + '\n'
										+ args.get_stackTrace());
							}))
				});
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		function removeUserFromGroup(groupName, currUser) {
			var deferred = $q.defer();
	
			try {
				if (typeof currUser == 'undefined')
					currUser = $().SPServices.SPGetCurrentUser();
				GetGroup(groupName, function(clientContext, group) {
					var users = group.get_users();
					var user = users.getByLoginName(currUser);
					users.remove(user);
					clientContext.executeQueryAsync(Function.createDelegate(this,
							deferred.resolve), Function.createDelegate(this,
							function(sender, args) {
								deferred.reject('Request failed. '
										+ args.get_message() + '\n'
										+ args.get_stackTrace());
							}))
				});
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		function ensureFolder(listName, folderName) {
			var deferred = $q.defer();
	
			try {
				var clientContext = new SP.ClientContext.get_current();
				var list = clientContext.get_web().get_lists().getByTitle(listName);
				var folders = list.getItems(SP.CamlQuery.createAllFoldersQuery());
				var rootFolder = list.get_rootFolder();
				// Check if the folder already exists
				clientContext.load(list);
				clientContext.load(rootFolder, "ServerRelativeUrl");
				clientContext.load(folders, "Include(FileLeafRef, ServerUrl)");
				var folderExists = false;
				clientContext
						.executeQueryAsync(function() {
	
							this.folderUrl = rootFolder.get_serverRelativeUrl()
									+ "/" + folderName;
							var enumerator = folders.getEnumerator();
							while (enumerator.moveNext()) {
								var folder = enumerator.get_current();
								if (folder.get_item("FileLeafRef") == folderName)
									folderExists = true;
								break;
							}
	
							if (!folderExists) { // Create folder if it doesn't
								// exist
								var itemCreateInfo = new SP.ListItemCreationInformation();
								itemCreateInfo
										.set_underlyingObjectType(SP.FileSystemObjectType.folder);
								itemCreateInfo.set_leafName(folderName);
								this.listItem = list.addItem(itemCreateInfo);
	
								this.listItem.update();
								clientContext.load(this.listItem);
	
								clientContext.executeQueryAsync(Function
										.createDelegate(this, function() {
											deferred.resolve(this.folderUrl)
										}));
							} else {
								deferred.resolve(this.folderUrl);
							}
						});
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		/** ******************************************************************** */
	
		function getListItemsByLookup(listName, lookupField, lookupId) {
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				var camlQuery = new SP.CamlQuery();
				var camlQuery = SP.CamlQuery.createAllItemsQuery();
				camlQuery
						.set_viewXml("<View Scope='RecursiveAll'><Query><Where><And><Eq><FieldRef Name='"
								+ lookupField
								+ "' LookupId='TRUE'/><Value Type='Lookup'>"
								+ lookupId
								+ "</Value></Eq><Neq><FieldRef Name='ContentType' /><Value Type='Text'>Folder</Value></Neq></And></Where></Query></View>");
				var listItems = oList.getItems(camlQuery);
				clientContext.load(listItems);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItems);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		function getListItemsByTextField(listName, field, text) {
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				var camlQuery = new SP.CamlQuery();
				var camlQuery = SP.CamlQuery.createAllItemsQuery();
				camlQuery
						.set_viewXml("<View Scope='RecursiveAll'><Query><Where><And><Eq><FieldRef Name='"
								+ field
								+ "'/><Value Type='Text'>"
								+ text
								+ "</Value></Eq><Neq><FieldRef Name='ContentType' /><Value Type='Text'>Folder</Value></Neq></And></Where></Query></View>");
				var listItems = oList.getItems(camlQuery);
				clientContext.load(listItems);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItems);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
	
			return deferred.promise;
		}
	
		function getAllListItems(listName, caml, optionalIncludeArr) {		
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				
				var batchResult = (caml && caml.prop && caml.prop.constructor === 'array');

				if (!caml){			
					var camlQuery = SP.CamlQuery.createAllItemsQuery();
					camlQuery.set_viewXml("<View Scope='RecursiveAll'></View>");
				} else {
					var camlQuery = new SP.CamlQuery();
					camlQuery.set_viewXml(caml);
				}

				if (optionalIncludeArr){
					camlQuery.set_viewXml(camlQuery.get_viewXml().replace("</View>", getViewFieldCamlFromFieldArray(optionalIncludeArr) + "</View>"));
				}
				var listItems = oList.getItems(camlQuery);
				if (optionalIncludeArr && false){
					clientContext.load(listItems, 'Include(' + optionalIncludeArr.join(',') + ')');
				} else {	
					clientContext.load(listItems);
				}
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItems);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
			return deferred.promise;
		}

		function getAllListItemsWithBatchedQueries(listName, camlArr, optionalIncludeArr) {		
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);

				var ret = [];
				for (var index in camlArr){
					var caml = camlArr[index];
					if (!caml){			
						var camlQuery = SP.CamlQuery.createAllItemsQuery();
						camlQuery.set_viewXml("<View Scope='RecursiveAll'></View>");
					} else {
						var camlQuery = new SP.CamlQuery();
						camlQuery.set_viewXml(caml);
					}
					var listItems = oList.getItems(camlQuery);
					if (optionalIncludeArr){
						clientContext.load(listItems, 'Include(' + optionalIncludeArr.join(',') + ')');
					} else {	
						clientContext.load(listItems);
					}					

					ret.push(listItems);
				}

				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(ret);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
			return deferred.promise;
		}

		
		function getAllListItemsWithPaging(options){
			var listName = options.listName;
			var caml = options.caml;
			var pageSize = options.pageSize || 50;
			
			var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				
				//Add paging
				//Row limit for page size
				if (caml && caml.toLowerCase().indexOf('<rowlimit') === -1){
					caml = caml.replace('</Query>', '</Query>' + '<RowLimit>' + pageSize + '</RowLimit>');
				}		
				
				//order by id descending to start with the newest and most relevant and going backward
				if (caml && caml.toLowerCase().indexOf('<orderby') === -1){
					caml = caml.replace('<Query>', '<Query><OrderBy><FieldRef Name="ID" Ascending="FALSE"/></OrderBy>');
				}		

				var camlQuery = new SP.CamlQuery();
				if (!caml){		
					var camlQuery = SP.CamlQuery.createAllItemsQuery();
					camlQuery.set_viewXml("<View Scope='RecursiveAll'><RowLimit>" + pageSize + "</RowLimit></View>");
				} else {
					camlQuery.set_viewXml(caml);
				}
				
				
				var listItems = oList.getItems(camlQuery);
				var syncPackage = {
					ctx: clientContext,
					deferred: deferred,
					list: oList,
					listItems: listItems,
					camlQuery: camlQuery					
				}
				clientContext.load(listItems);
				clientContext.executeQueryAsync(Function.createDelegate(this, function(){onPagingQuerySucceeded(syncPackage)}), Function.createDelegate(this, onPagingQueryFailure));
				
			} catch (err) {
				deferred.reject(err);
			}

			function onPagingQuerySucceeded(syncPackage) {
				var moreData = [];
				var enumerator = syncPackage.listItems.getEnumerator();
				var hasResults = false;
				var batchResults = [];
				while (enumerator.moveNext()){
					batchResults.push(enumerator.get_current().get_fieldValues())					
					hasResults = true
				}

				syncPackage.deferred.notify(batchResults);
				syncPackage.position = syncPackage.listItems.get_listItemCollectionPosition();			
				if (hasResults){
					
					if (syncPackage.position == null){
						syncPackage.deferred.resolve();
					} else {
						camlQuery.set_listItemCollectionPosition(syncPackage.position);
						listItems = syncPackage.list.getItems(camlQuery);
						clientContext.load(listItems);
						var newSyncPackage = {
							ctx: syncPackage.ctx,
							deferred: syncPackage.deferred,
							list: syncPackage.list,
							listItems: listItems,
							camlQuery: camlQuery
						};
						clientContext.executeQueryAsync(Function.createDelegate(this, function(){onPagingQuerySucceeded(newSyncPackage)}), Function.createDelegate(this, onPagingQueryFailure));	
					}
				} else {
					deferred.resolve();
				}				
			}
			
			function onPagingQueryFailure(sender, args) {
				deferred.reject({message: args.get_message(), stackTrace: args.get_stackTrace()});
			}
			
			
			return deferred.promise;
		}
			
		function getAllItemsInFolder(listName, folderName) {
	/*		var caml = "<View Scope=\"RecursiveAll\"> " +
	                    "<Query>" +
		                    "<Where>" +
		                       	"<Eq>" +
			                        "<FieldRef Name=\"FileDirRef\" />" +
			                        "<Value Type=\"Text\">" + caml + "</Value>" +
		                     	"</Eq>" +
		                    "</Where>" +
	                    "</Query>" +
	                    "</View>";
	                    */
	   		var deferred = $q.defer();
	
			try {
				var clientContext = getCtx();
				var oList = clientContext.get_web().get_lists()
						.getByTitle(listName);
				
				var camlQuery = new SP.CamlQuery();
				var camlQuery = SP.CamlQuery.createAllItemsQuery();
				camlQuery.set_folderServerRelativeUrl(folderName);
				var listItems = oList.getItems(camlQuery);
				clientContext.load(listItems);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {
							deferred.resolve(listItems);
						}), Function.createDelegate(this, function(sender, args) {
					deferred.reject(args);
				}));
			} catch (err) {
				deferred.reject(err);
			}
			return deferred.promise;
		}
	
		function csomToJson(obj, fieldMap){
			var ret = {};
	
			for (var key in obj.get_fieldValues()){
				try {
					var value = obj.get_fieldValues()[key];
					if (value != null){
						if (!fieldMap ){
							ret[key] = value;
						} else {
							if (fieldMap[key]){
								var prop = fieldMap[key].replaced ? fieldMap[key].mapTo : key;
								switch(fieldMap[key].type){
									case 1: //Integer
									case 2: //Text
									case 3: //Note
									case 4: //DateTime
									case 5: //Counter
									case 6: //Choice
									case 7: //Lookup
									case 8: //Boolean
									case 9: //Number
									case 14: //Guid
									case 15: //MultiChoice returns an array, which is what we want
									case 17: //Calculated
									case 18: //File
										ret[prop] = value;
										break;
									case 25: //ContentTypeId
										ret[prop] = value.toString();
										break;
									case 20: 
										if (!Array.isArray(value)){
											//User (Single)
											var person = value;
											ret[prop] = person.get_lookupId() + ";#" +  person.get_lookupValue();
										} else {
											//Multiple
											var person = value[0];
											ret[prop] = person.get_lookupId() + ";#" +  person.get_lookupValue();
											for (var index = 1; index < value.length; index++){
												person = value[index];
												ret[prop] += ";#" +  person.get_lookupId() + ";#" +  person.get_lookupValue();
											}
										}
										break;							
									case 23: //ModStat
									case 28: //WorkflowStatus
										break;
									default: 
										log.warn("Update dataAccess.csomToJson for Field " + key + " of type " + fieldMap[key].typeAsString + " which has a value of " + fieldMap[key].type);
										ret[prop] = value;
										break;
								}
							}
						}
					}
				} catch(err){	
					log.error("Problem setting the " + key + " field: " + err);				
				}
			}
			
			return ret;
		}
		
		function jsonToCsom(obj, listItem, optionalFieldMap){
			for (var key in obj) {
				//Set DateTime to UTC as-needed
				if (optionalFieldMap && !optionalFieldMap[key]){
					throw { message: key + " does not exist" };
				}
				switch (key){
					//Don't write these items back to SP
					case 'ID':
					case 'ItemChildCount':
					case 'FolderChildCount':
					case 'Modified_x0020_By':
					case 'ProductWorkspace':
					case 'ReviewHistoryURL':
					case 'FileRef':
					case 'FileDirRef':
					case 'Last_x0020_Modified':
					case 'Created_x0020_Date':
					case 'Author':
					case 'Editor':
					case 'Modified':
					case 'CheckedOutUserId':
					case 'Created':
						break;
					default: 
						//log.info("setting " + key + " field to '" + obj[key] + "'");
						if (optionalFieldMap){
							switch(optionalFieldMap[key].type){
								case 1: //Integer
								case 2: //Text
								case 3: //Note
								case 4: //DateTime
								case 6: //Choice
								case 7: //Lookup
								case 8: //Boolean
								case 9: //Number
								case 15: //Multi Choice
								case 20: //User
								case 25: //Content Type
									listItem.set_item(key, obj[key]);
									break;
								case 5: //Counter
								case 14: //Guid
								case 17: //Calculated
								case 18: //File -- Not sure what to do with this
									break;					
								default:							 
									log.warn("Update dataAccess.jsonToCsom for Field " + optionalFieldMap[key].typeAsString + " which has a value of " + optionalFieldMap[key].type);
									listItem.set_item(key, obj[key]);
									break;
							}			
						} else {
							listItem.set_item(key, obj[key]);
						}
						break;
				}
			}
		}

		function getUsersFromUserString(value){
			var ret = [];
			var pieces = value.split(";#");
	    	if (pieces.length == 1){
		    	ret.push(pieces[0]);
		    } else if (pieces.length == 2) {
		    	ret.push(pieces[0] + ";#" + pieces[1]);
		    } else {
		    	for (var i = 0; i < pieces.length; i = i+2){
					ret.push(pieces[i] + ";#" + pieces[i+1]);    	
		    	}
		    }
		    
		    return ret;
		}

		function getViewFieldCamlFromFieldArray(fieldArr){
			var viewFields = "<ViewFields>";
			for (var index in fieldArr){
				viewFields += "<FieldRef Name = '" + fieldArr[index] + "' />"; 
			}
			viewFields += "</ViewFields>";
			return viewFields;
		}
		
		function addEnsuredUserToCache(user){
			ensuredUserCacheObj[user] = {
				display: user
			};	
		}
		
		function ensureUsers(userArr){
			var deferred = $q.defer();
			try {
				var clientContext = getCtx();
				var web = clientContext.get_web();
				
				var nonrepeatingArr = [];
				var usersToEnsure = [];
				
				//If more than one user has been entered, like from a people picker in the following format: 4180;#Craig Floyd;#4096;#Rahul Gupta, then split into pieces
				$.each(userArr, function(i, el){
					usersToEnsure = usersToEnsure.concat(getUsersFromUserString(el));
				});
	
				var nonrepeatingArr = [];
				$.each(usersToEnsure, function(i, el){
	   				if((!ensuredUserCacheObj[el]) && ($.inArray(el, nonrepeatingArr ) === -1)) {   					
	   					nonrepeatingArr.push(el);
	   				}
				});
								
				var csomUsers = {};
				if (nonrepeatingArr.length == 0){
					deferred.resolve(ensuredUserCacheObj);
				} else {
					for (var index in nonrepeatingArr){
						//Strip off the user id and the ";#" before the username we need to ensure
						var userPieces = nonrepeatingArr[index].split(';#');
						var user = web.ensureUser(userPieces[userPieces.length-1]);
						csomUsers[nonrepeatingArr[index]] = user;
						clientContext.load(user);
					}		
					
					clientContext.executeQueryAsync(Function.createDelegate(this,
						function() {	
							for (var key in csomUsers){
								ensuredUserCacheObj[key]= {
									id: csomUsers[key].get_id(),
									title: csomUsers[key].get_title(),
									loginName: csomUsers[key].get_loginName(),
									email: csomUsers[key].get_email(),
									principalType: csomUsers[key].get_principalType(),
									display: csomUsers[key].get_id() + ";#" + csomUsers[key].get_title()
								};
							}
							deferred.resolve(ensuredUserCacheObj);
						}), Function.createDelegate(this, function(sender, args) {
						deferred.reject({message: "dataAccess.ensureUsers:" + args.get_message()})
					}));			
				}
			} catch(err){
				deferred.reject(err);
			}
			return deferred.promise;				
		}

		function getWorkflowsForItem(itemUrl){	
			return $q(function(resolve, reject){
				$().SPServices({
				    operation: 'GetWorkflowDataForItem', 
				    item: itemUrl,
				    completefunc: function(data,status){
				    	switch (status){
				    		case 'error':
				    			reject(data.responseText);
				    			break;
				    		case 'success':
						    	resolve([data.responseText, status]);
						    	break;
						    default: 
						    	log.debug('unhandled status in getWorkflowItems: ' + status);
						    	resolve([data.responseText, status]);
						    	break;
				    	}
				    }
				});
			}).then(function(values){
				var xml = values[0];
				var status = values[1];
				var ret = {
					running: [],
					templates: [],
					status: status
				};

				var running = $(xml).find("ActiveWorkflowsData>Workflows>Workflow");
				if (running.length > 0){
					for (var index = 0; index < running.length; index++){
						var row = $(running[index]);
						if ((row.attr('InternalState') & WORKFLOW_STATE.Running) == WORKFLOW_STATE.Running){
							ret.running.push({
								author: row.attr('Author'),
								created: row.attr('Created'),
								id: row.attr('TemplateId'),
								statusPageUrl: row.attr('StatusPageUrl'),
								state: row.attr('InternalState')
							})
						}
					}
				}

				//Get the templates for available workflows
          		$(xml).find("WorkflowTemplates > WorkflowTemplate").each(function (i,e) {
          			var params = [];          			
          			var name = $(this).attr("Name");
          			var id = $(this).find("WorkflowTemplateIdSet").attr("TemplateId");
          			var running = false;          			
          			var xmlParams = (new DOMParser()).parseFromString($(this).find('AssociationData>string')[0].childNodes[0].nodeValue, "text/xml").childNodes[0].childNodes[1].childNodes[0].childNodes;  	          			    				          													
      				for (var index = 0; index < xmlParams.length; index++){
          				params.push(xmlParams[index].nodeName.replace("d:", ""))
      				}

      				for (var index = 0; index < ret.running.length; index ++){
      					var row = ret.running[index];
      					if (id == row.id){
      						running = row
      						row.name = name;
      					}
      				}

          			ret.templates.push({
          				name: name,
          				id: id,
          				params: params,
          				running: running          				
          			})          			
  				})

				//here
				ret.templates = ret.templates.sort(function(a, b){
					if(a.name < b.name) return -1;
				    if(a.name > b.name) return 1;
				    return 0;
				 })

	        	return ret;
			})
		}
	
		//Subset of the functionality of getWorkflowsForItem. Only gets available templates, but does not get currently running workflows or completed workflows 
		function getWorkflowTemplatesForItem(itemUrl){
			return $q(function(resolve, reject){
				$().SPServices({
			        operation: "GetTemplatesForItem",
			        item: itemUrl,
			        async: true,
			        completefunc: function (xData,Status) {
			        	resolve(xData.responseXML);
			        }
			    })
			}).then(function(xml){
				var ret = [];
          		$(xml).find("WorkflowTemplates > WorkflowTemplate").each(function (i,e) {
          			var params = [];
          			var that = this;
          			var xmlParams = (new DOMParser()).parseFromString($(this).find('AssociationData>string')[0].childNodes[0].nodeValue, "text/xml").childNodes[0].childNodes[1].childNodes[0].childNodes;  	          			    				          													
      				for (var index = 0; index < xmlParams.length; index++){
          				params.push(xmlParams[index].nodeName.replace("d:", ""))
      				}

          			ret.push({
          				name: $(that).attr("Name"),
          				id: $(that).find("WorkflowTemplateIdSet").attr("TemplateId"),
          				params: params
          			})
  				})
	        	return ret;
			})
		}


		
		//Untested
		function startWorkflow(itemUrl, templateId, params){			
			var workflowParamaters = "<Data>";
			for (var key in params){
				if (typeof params[key] == 'string') {
					var encodedParam = params[key]
						.replace(/&/g, '&amp;')
	               		.replace(/</g, '&lt;')
	               		.replace(/>/g, '&gt;')
		               	.replace(/"/g, '&quot;')
	               		.replace(/'/g, '&apos;');
					 workflowParamaters += "<" + key + ">" + encodedParam + "</" + key + ">"
				} else {
					workflowParamaters += "<" + key + ">" + params[key] + "</" + key + ">"
				}
			}
 			workflowParamaters += "</Data>";

			return $q(function(resolve, reject){
				$().SPServices({
					operation: "StartWorkflow",
					item: itemUrl,
					templateId: "{" + templateId + "}",
					workflowParameters: workflowParamaters,
					completefunc: function(xData,Status) {
						var ret = {
							xml: xData.responseText,
							statusText: xData.statusText,
							statusCode: xData.status,
							Status: Status
						};
						if (Status == 'success'){
							resolve(ret);
						} else {
							reject(ret);
						}
					}
				});
			})
		}

		function upload(txtContent, destinationUrl) {
		    var jsStream = btoa(unescape(encodeURIComponent(txtContent)));
		    
	    	return $q(function(resolve, reject){
		    	$().SPServices({
					operation: "CopyIntoItems",
					SourceUrl: 'http://null',
					DestinationUrls: [destinationUrl],
					Stream: jsStream,
					Fields: ["<FieldInformation Type='File' />"],
					completefunc: function(xData, status){
						switch(status){
							case 'error': 
								reject(xData.responseText);
								break;
							default: 
								resolve(xData.responseText);
								break;
						}
					}
				});
	    	})
		}		
	}
});



