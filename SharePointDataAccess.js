var dataAccess = function() {
	var _siteUrl;
	function siteUrl(){
		if (!_siteUrl){
			_siteUrl = $().SPServices.SPGetCurrentSite().replace(/^(?:\/\/|[^\/]+)*\//, "/");			
		}
		return _siteUrl;
	}

	function getFieldsInList(listName){
	
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var list = clientContext.get_web().get_lists().getByTitle(listName);
			var listFields = list.get_fields();
			clientContext.load(listFields, 'Include(Title,InternalName,Description,FieldTypeKind,TypeAsString)');
		    clientContext.executeQueryAsync(Function.createDelegate(this, function(){
			   	var fields = {};
		        var fieldEnumerator = listFields.getEnumerator();
		        while (fieldEnumerator.moveNext()) {
		            var oField = fieldEnumerator.get_current();
		            if (oField.get_internalName()){
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
							case 'Regional':
							case 'Regional0':	
							case '_Level':
							case '_IsCurrentVersion':
							case 'owshiddenversion':
							case '_UIVersion': 
							case 'FSObjType':	
							case '_UIVersionString':
							case 'Order':
							case 'GUID':
							case 'WorkflowVersion':
							case 'ParentVersionString':
							case 'ParentLeafName':
							case 'ContentTypeId':
							case 'HTML_x0020_File_x0020_Type':
							case 'File_x0020_Size':
							case 'SortBehavior':
							case 'CheckedOutUserId':
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
							case 'ReviewHistory0':
								break;
							default: 
					            fields[oField.get_internalName()] = {
					            	title: oField.get_title(),
					            	internalName: oField.get_internalName(),
					            	description: oField.get_description(),
					            	typeAsString: oField.get_typeAsString(),
					            	type: oField.get_fieldTypeKind()
					            };
					        break;
					 	}
			         }
		        }
		        
		        promise.resolve(fields);
		    }),	Function.createDelegate(this, function(){
		    	promise.reject(args.get_message());		    
		    }));

   		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	function createListItem(listName, obj) {
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
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
						promise.resolve(this.oListItem, obj);
					}), Function.createDelegate(this, function(sender, args) {
						promise.reject({message: "dataAccess.createListItem:" + args.get_message()})
					}));
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}
	
	//Todo: Return updated fields maybe? Check to see if someone else is working on item maybe? Call me maybe?
	function updateListItem(listName, obj, fields) {
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var oList = clientContext.get_web().get_lists()
					.getByTitle(listName);
			this.listItem = oList.getItemById(obj.ID);
			
			jsonToCsom(obj, this.listItem, fields);
			this.listItem.update();

			clientContext.load(this.listItem);
			clientContext.executeQueryAsync(Function.createDelegate(this,
					function() {
						promise.resolve(this.listItem);
					}), Function.createDelegate(this, function(sender, args) {
						promise.reject({message: args.get_message()});
					}));

		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	
	function createDocumentSet(listName, obj, fields, optionalDocumentSetContentTypeId){
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
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
						log("Doc Set Created");						    
					    promise.resolve(this.oListItem);
					}), Function.createDelegate(this, function(sender, args) {
						error("Doc Set Creation Error" +  args.get_message());
						promise.reject({message: "dataAccess.createDocumentSet:" + args.get_message()})
					}));
		
		
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();	
	}

	var choiceCache = {};
	function getChoiceFieldChoices(listName, fieldName){
		var deferred = $.Deferred();

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
							var choices = this.choiceField.get_choices();
							if (!choiceCache[listName]){
								choiceCache[listName] = {};
							}
							choiceCache[listName][fieldName] = choices 
			    			deferred.resolve(choices);
			    		}), Function.createDelegate(this, function(sender, args) {
			    			debugger;
							deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + args.get_message()})
						}));
			}
   		} catch (err) {
   			debugger;
			deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + err.message});
		}

		return deferred.promise();	
	}
	
	function preCacheChoiceFieldChoices(listName, fieldNames){
		var deferred = $.Deferred();
		try {
			var ctx = new SP.ClientContext(siteUrl());
			var list = ctx.get_web().get_lists().getByTitle(listName);
			this.fields = [];
			for (index in fieldNames){				
				var choiceField = ctx.castTo(list.get_fields().getByInternalNameOrTitle(fieldNames[index]), SP.FieldChoice);				
				this.fields.push(choiceField);
				ctx.load(choiceField);
			}

			ctx.executeQueryAsync(Function.createDelegate(this,
					function() {
						if (!choiceCache[listName]){
							choiceCache[listName] = {};
						}

						for (index in this.fields){
							var choiceField = this.fields[index];
							choiceCache[listName][choiceField.get_internalName()] = choiceField.get_choices();													
						}						

		    			deferred.resolve(choiceCache);
		    		}), Function.createDelegate(this, function(sender, args) {
		    			debugger;
						deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + err.get_message()})
					}));
   		} catch (err) {
   			debugger;
			deferred.reject({message: "dataAccess.getChoiceFieldChoices:" + err.message});
		}

		return deferred.promise();	
	}
	
	function getCurrentUser(){
		var promise = $.Deferred();

		try {
			var ctx = new SP.ClientContext(siteUrl());
			var user = ctx.get_web().get_currentUser();
			ctx.load(user);
			ctx.executeQueryAsync(function () {			
		    	var ret = {
		    		Title: web.get_title(),
		    		Description: web.get_description(),
		    		CurrentUser: user.get_email()
		    	}
		    	deferred.resolve(ret);
		    }, function(err){
		    	deferred.reject({message: err.get_message()})
		    });
   		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}
	
	function getListItemById(listName, id) {
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var oList = clientContext.get_web().get_lists()
					.getByTitle(listName);
			this.listItem = oList.getItemById(id);

			clientContext.load(this.listItem);
			clientContext.executeQueryAsync(Function.createDelegate(this,
					function() {
						promise.resolve(this.listItem);
					}), Function.createDelegate(this, function(sender, args) {
						promise.reject(args);
					}));
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}
	
	function getLibraryItemByFileLeafRef(listName, fileLeafRef){
		var promise = $.Deferred();
		if (!fileLeafRef){
			promise.resolve(0);
		} else {
			try {
				var clientContext = new SP.ClientContext(siteUrl());
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
								promise.resolve(listEnumerator.get_current().get_id());
							} else {							
								promise.resolve(0);
							}
						}), Function.createDelegate(this, function(sender, args) {
							promise.reject(args);
						}));
			} catch (err) {
				promise.reject(err);
			}
		}

		return promise.promise();
	}

	function getListItemByIdWithCaching(listName, id) {
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var oList = clientContext.get_web().get_lists()
					.getByTitle(listName);
			var listItem = oList.getItemById(id);

			clientContext.load(listItem);
			clientContext.executeQueryAsync(Function.createDelegate(this,
					function() {
						promise.resolve(listItem);
					}), Function.createDelegate(this, function(sender, args) {
				promise.reject(args);
			}));
		} catch (err) {
			promise.reject(err);
		}
		return promise.promise();
	}

	function createListItemInFolder(listName, obj, folderPath) {
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var oList = clientContext.get_web().get_lists()
					.getByTitle(listName);

			var itemCreateInfo = new SP.ListItemCreationInformation();
			itemCreateInfo.set_folderUrl(folderPath);
			this.oListItem = oList.addItem(itemCreateInfo);

			for (key in obj) {
				this.oListItem.set_item(key, obj[key]);
			}

			this.oListItem.update();

			clientContext.load(this.oListItem);
			clientContext.executeQueryAsync(Function.createDelegate(this,
					function() {
						promise.resolve(this.oListItem);
					}), Function.createDelegate(this, function(sender, args) {
				promise.reject(args);
			}));
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}
	
	function deleteListItemById(listName, id) {
		var promise = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var oList = clientContext.get_web().get_lists()
					.getByTitle(listName);
			var listItem = oList.getItemById(id);
			listItem.deleteObject();

			clientContext.load(listItem);
			clientContext.executeQueryAsync(Function.createDelegate(this,
					function() {
						promise.resolve();
					}), Function.createDelegate(this, function(sender, args) {
				promise.reject(args);
			}));
		} catch (err) {
			promise.reject(err);
		}
		return promise.promise();
	}

	function createGroup(siteUrl, groupName, description) {
		var promise = $.Deferred();

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
						promise.resolve(this.oGroup);
					}), Function.createDelegate(this, function(sender, args) {
				promise.reject(args);
			}));
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	function isGroupMemberSync(groupName, userLoginName) {
		var isGroupMember = false;
		if (typeof userLoginName == 'undefined') {
			userLoginName = $().SPServices.SPGetCurrentUser();
		}
		$()
				.SPServices(
						{
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
		var promise = $.Deferred();

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
					
					promise.resolve(userInGroup, user.get_title());
                },
                function OnFailure(sender, args) {
					promise.reject({message: args.get_message()});
                }
	        );
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();

	}

	function getGroup(strGroupName) {
		var promise = $.Deferred();

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
				promise.resolve(null);
			});

			// GroupCollection - Load - SUCCESS
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
						promise.resolve(currentContext, group);
						return;
					}
				}
				promise.resolve(null);
			}
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	function addUserToGroup(groupName, currUser) {
		var promise = $.Deferred();

		try {

			if (typeof currUser == 'undefined')
				currUser = $().SPServices.SPGetCurrentUser();
			GetGroup(groupName, function(clientContext, group) {
				var userCreationInfo = new SP.UserCreationInformation();
				userCreationInfo.set_loginName(currUser);
				group.get_users().add(userCreationInfo);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						promise.resolve), Function.createDelegate(this,
						function(sender, args) {
							promise.reject('Request failed. '
									+ args.get_message() + '\n'
									+ args.get_stackTrace());
						}))
			});
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	function removeUserFromGroup(groupName, currUser) {
		var promise = $.Deferred();

		try {
			if (typeof currUser == 'undefined')
				currUser = $().SPServices.SPGetCurrentUser();
			GetGroup(groupName, function(clientContext, group) {
				var users = group.get_users();
				var user = users.getByLoginName(currUser);
				users.remove(user);
				clientContext.executeQueryAsync(Function.createDelegate(this,
						promise.resolve), Function.createDelegate(this,
						function(sender, args) {
							promise.reject('Request failed. '
									+ args.get_message() + '\n'
									+ args.get_stackTrace());
						}))
			});
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	function ensureFolder(listName, folderName) {
		var promise = $.Deferred();

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
										promise.resolve(this.folderUrl)
									}));
						} else {
							promise.resolve(this.folderUrl);
						}
					});
		} catch (err) {
			promise.reject(err);
		}

		return promise.promise();
	}

	/** ******************************************************************** */

	function getListItemsByLookup(listName, lookupField, lookupId) {
		var deferred = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
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

		return deferred.promise();
	}

	function getListItemsByTextField(listName, field, text) {
		var deferred = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
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

		return deferred.promise();
	}

	function getAllListItems(listName, caml) {
		var deferred = $.Deferred();

		try {
			var clientContext = new SP.ClientContext(siteUrl());
			var oList = clientContext.get_web().get_lists()
					.getByTitle(listName);
			
			var camlQuery = new SP.CamlQuery();
			if (!caml){		
				var camlQuery = SP.CamlQuery.createAllItemsQuery();
				camlQuery.set_viewXml("<View Scope='RecursiveAll'></View>");
			} else {
				camlQuery.set_viewXml(caml);
			}
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
		return deferred.promise();
	}
	
	function csomToJson(obj, fields, optionalFieldMap){
		var ret = {};

		for (index in fields){
			try {
				var key = fields[index];
				if (obj.get_item(key) != null){
					if (!optionalFieldMap){
						ret[key] = obj.get_item(key);
					} else {
						if (typeof obj.get_item(key) != 'undefined'){
							switch(optionalFieldMap[key].type){
								case 1: //Integer
								case 2: //Text
								case 5: //Counter
								case 6: //Choice
								case 7: //Lookup
								case 8: //Boolean
								case 9: //Number
								case 14: //Guid
								case 15: //MultiChoice returns an array, which is what we want
								case 17: //Calculated
								case 25: //ContentTypeId
									ret[key] = obj.get_item(key);
									break;
								case 4: //DateTime
									var dateTime = moment(new Date(obj.get_item(key)));
									ret[key] = {//Fri Jul 17 2015 00:00:00 GMT-0400 (Eastern Standard Time)								
										date: dateTime.format('MM/DD/YYYY'),
										time: dateTime.format('h:mm:ss a')
									};
									break;
								case 20: //User (Single)
									var person = obj.get_item(key);
									//Todo: Deal with claims
									ret[key] = person.get_lookupId() + ";#" +  person.get_lookupValue();
									break;							
								case 18: //File
								case 23: //ModStat
								case 28: //WorkflowStatus
									break;
								default: 
									warn("Update dataAccess.csomToJson for Field " + key + " of type " + optionalFieldMap[key].typeAsString + " which has a value of " + optionalFieldMap[key].type);
									ret[key] = obj.get_item(key);
									break;
							}
						}
					}
				}
			} catch(err){	
				error("Problem setting the " + fields[index] + " field: " + err);				
			}
		}
		
		return ret;
	}
	
	function jsonToCsom(obj, listItem, optionalFieldMap){
		for (key in obj) {
			//Set DateTime to UTC as-needed
			if (!optionalFieldMap[key]){
				throw { message: key + " does not exist" };
			}
			switch (key){
				//Don't write these items back to SP
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
				case 'Created':
					break;
				default: 
					log ("setting " + key + " field to '" + obj[key] + "'");
					switch(optionalFieldMap[key].type){
						case 1: //Integer
						case 2: //Text
						case 6: //Choice
						case 7: //Lookup
						case 8: //Boolean
						case 9: //Number
						case 15: //Multi Choice
						case 20: //User
						case 25: //Content Type
							listItem.set_item(key, obj[key]);
							break;
						case 4: //DateTime
							if (typeof obj[key].date == 'undefined'){
								obj[key].date = '';
							}
							if (typeof obj[key].time == 'undefined'){
								obj[key].time = '';
							}
							var dateTime = moment(new Date(obj[key].date + " " + obj[key].time)).utc().toJSON();
							listItem.set_item(key, moment(new Date(dateTime)).utc().toJSON());	
							break;
						case 5: //Counter
						case 14: //Guid
						case 17: //Calculated
						case 18: //File -- Not sure what to do with this
							break;					
						default: 
							warn("Update dataAccess.jsonToCsom for Field " + optionalFieldMap[key].typeAsString + " which has a value of " + optionalFieldMap[key].type);
							listItem.set_item(key, obj[key]);
							break;
					}			
					break;
			}
		}
	}
	
	var ensuredUserCacheObj = {};
	
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
	
	function addEnsuredUserToCache(user){
		ensuredUserCacheObj[user] = {
			display: user
		};	
	}
	
	function ensureUsers(userArr){
		var deferred = $.Deferred();
		try {
			var clientContext = new SP.ClientContext(siteUrl());
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
				for(index in nonrepeatingArr){
					//Strip off the user id and the ";#" before the username we need to ensure
					var userPieces = nonrepeatingArr[index].split(';#');
					var user = web.ensureUser(userPieces[userPieces.length-1]);
					csomUsers[nonrepeatingArr[index]] = user;
					clientContext.load(user);
				}		
				
				clientContext.executeQueryAsync(Function.createDelegate(this,
					function() {	
						for (key in csomUsers){
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
		return deferred.promise();				
	}
	
	//Untested
	function startWorkflow(){
		var deferred = $.Deferred();
		try {
			deferred.resolve("Not Implemented");
		} catch(err){
			deferred.reject(err);
		}
		return deferred.promise();				

/*
	      function getSharePointListGUID(){
	      	  //Todo: What list are we talking about here? Maybe get the GUID another way. 
	          var listGUID = SP.ListOperation.Selection.getSelectedList();
	          return listGUID;
	      }
	      function getQSParameterByName(name) {
	          var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
	          return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
	      }
	      function startBLApprovalWorkflow() {
	          var goTo = getQSParameterByName("ID");
	          var workflowURL = "";
	          var item = "";
	          var template = "";
	          var siteRoot = "";
	          var listGUID = getSharePointListGUID();
	          siteRoot = $().SPServices.SPGetCurrentSite();
	              itemRelativeUrl = getQSParameterByName("RootFolder");
	          item = siteRoot.replace(relativeUrl,"") + itemRelativeUrl;
	          $().SPServices({
	              operation: "GetTemplatesForItem",
	              item: item,
	              async: false,
	              completefunc: function (xData, Status) {
	                  $(xData.responseXML).find("WorkflowTemplates > WorkflowTemplate").each(function(i,e) 
	                  {
	                      if ( $(this).attr("Name") == "Send Email Notification" ) {              
	                          var guid = $(this).find("WorkflowTemplateIdSet").attr("TemplateId");        
	                          if ( guid != null ) {
	                              template = "{" + guid + "}";
	                          }
	                      }
	                  });
	              }
	          });
	          workflowURL = siteRoot + "/_layouts/NintexWorkflow/StartWorkflow.aspx?List=" + listGUID + 
	          "&ID=" + goTo +"&TemplateID=" + template;
	          window.location.href = workflowURL;
	      }
*/
	}

	return {
		csomToJson: csomToJson,
		createListItem : createListItem,
		updateListItem: updateListItem,
		createDocumentSet: createDocumentSet,
		getChoiceFieldChoices: getChoiceFieldChoices,
		preCacheChoiceFieldChoices: preCacheChoiceFieldChoices,
		getCurrentUser: getCurrentUser,
		getListItemById : getListItemById,
		getListItemByIdWithCaching : getListItemByIdWithCaching,
		getListItemsByLookup : getListItemsByLookup,
		getListItemsByTextField: getListItemsByTextField,
		getLibraryItemByFileLeafRef: getLibraryItemByFileLeafRef,
		getAllListItems: getAllListItems,
		getFieldsInList: getFieldsInList,
		createListItemInFolder : createListItemInFolder,
		createGroup : createGroup,
		deleteListItemById: deleteListItemById,
		isGroupMember : isGroupMemberCSOM,
		getGroup : getGroup,
		addUserToGroup : addUserToGroup,
		removeUserFromGroup : removeUserFromGroup,
		ensureFolder : ensureFolder,
		ensureUsers: ensureUsers,
		addEnsuredUserToCache: addEnsuredUserToCache,
		sync : {
			isGroupMember : isGroupMemberSync
		}
	}
}();
