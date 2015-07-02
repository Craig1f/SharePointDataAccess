var dataAccess = function() {
    //Takes a JSON object, converts it to a CSOM object, and adds it to the list. 
    function createListItem(listName, obj) {
        var promise = $.Deferred();

        try {
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
            var oList = clientContext.get_web().get_lists()
                    .getByTitle(listName);

            var itemCreateInfo = new SP.ListItemCreationInformation();
            this.oListItem = oList.addItem(itemCreateInfo);

            //Converts the JSON-formated object into CSOM. 
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

    function getListItemById(listName, id) {
        var promise = $.Deferred();

        try {
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
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

    function getListItemByIdWithCaching(listName, id) {
        var promise = $.Deferred();

        try {
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
            var oList = clientContext.get_web().get_lists()
                    .getByTitle(listName);
            var listItem = oList.getItemById(id);

            if (typeof this.cache == 'undefined') {
                this.cache = [];
            } else if (this.cache.hasOwnProperty(listName + ":" + id)) {
                promise.resolve(this.cache[listName + ":" + id]);
            }

            clientContext.load(listItem);
            clientContext.executeQueryAsync(Function.createDelegate(this,
                    function() {
                        this.cache[listName + ":" + id] = listItem;
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
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
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

    function createGroup(siteUrl, groupName, description) {
        var promise = $.Deferred();

        try {
            var clientContext = new SP.ClientContext(siteUrl);
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
                                        "Group[Name='" + GroupName + "']").length == 1) {
                                    isGroupMember = true;
                                }
                            }
                        });

        return isGroupMember;
    }

    function isGroupMemberAsync(groupName, userLoginName) {
        var promise = $.Deferred();

        try {
            if (typeof userLoginName == 'undefined') {
                userLoginName = $().SPServices.SPGetCurrentUser();
            }
            $()
                    .SPServices(
                            {
                                operation : "GetGroupCollectionFromUser",
                                userLoginName : userLoginName,
                                async : true,
                                completefunc : function(xData, Status) {
                                    var isGroupMember = $(xData.responseXML)
                                            .find(
                                                    "Group[Name='" + GroupName
                                                            + "']").length == 1;
                                    promise.resolve(GroupName, userLoginName,
                                            isGroupMember);
                                }
                            });
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
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
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
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
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

    function getAllListItems(listName) {
        var deferred = $.Deferred();

        try {
            var siteUrl = $().SPServices.SPGetCurrentSite();
            var clientContext = new SP.ClientContext(siteUrl);
            var oList = clientContext.get_web().get_lists()
                    .getByTitle(listName);
            var camlQuery = new SP.CamlQuery();
            var camlQuery = SP.CamlQuery.createAllItemsQuery();
            camlQuery.set_viewXml("<View Scope='RecursiveAll'></View>");
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
    
    //untested
    //http://sharepoint.stackexchange.com/questions/58301/csom-get-list-items-return-simple-data-structure
    function omToJson(csomObj){
    	return JSON.stringify(csomObj.get_fieldValues());
    }
    
    //untested
    function JsonToOm(jsonObj, csomObj){
    	for (prop in jsonObj){
    		csomObj.set_item(prop, jsonObj[prop]);
    	}
    }

    return {
        createListItem : createListItem,
        getListItemById : getListItemById,
        getListItemByIdWithCaching : getListItemByIdWithCaching,
        getListItemsByLookup : getListItemsByLookup,
        getListItemsByTextField: getListItemsByTextField,
        getAllListItems: getAllListItems,
        createListItemInFolder : createListItemInFolder,
        createGroup : createGroup,
        isGroupMember : isGroupMemberAsync,
        getGroup : getGroup,
        addUserToGroup : addUserToGroup,
        removeUserFromGroup : removeUserFromGroup,
        ensureFolder : ensureFolder,
        sync : {
            isGroupMember : isGroupMemberSync,
        }
    }
}();
