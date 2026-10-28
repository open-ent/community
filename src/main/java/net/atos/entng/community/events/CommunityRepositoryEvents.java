/*
 * Copyright © Région Nord Pas de Calais-Picardie,  Département 91, Région Aquitaine-Limousin-Poitou-Charentes, 2016.
 *
 * This file is part of OPEN ENT NG. OPEN ENT NG is a versatile ENT Project based on the JVM and ENT Core Project.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation (version 3 of the License).
 *
 * For the sake of explanation, any module that communicate over native
 * Web protocols, such as HTTP, with OPEN ENT NG is outside the scope of this
 * license and could be license under its own terms. This is merely considered
 * normal use of OPEN ENT NG, and does not fall under the heading of "covered work".
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

package net.atos.entng.community.events;

import static org.entcore.common.neo4j.Neo4jResult.validResultHandler;

import io.vertx.core.Vertx;
import org.entcore.common.neo4j.Neo4j;
import io.vertx.core.Handler;
import io.vertx.core.eventbus.EventBus;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;

import fr.wseduc.webutils.Either;

public class CommunityRepositoryEvents extends PagesRepositoryEvents {

	private static final Logger log = LoggerFactory.getLogger(CommunityRepositoryEvents.class);
	private final Neo4j neo4j = Neo4j.getInstance();
	private final EventBus eb;

	public CommunityRepositoryEvents(EventBus eb, Vertx vertx) {
		super(vertx);
		this.eb = eb;
	}

	@Override
	public void deleteGroups(JsonArray groups) {
		super.deleteGroups(groups);
		// No group members in Community
		log.info("Event [deleteGroups] : no goup to delete");
	}

	@Override
	public void deleteUsers(JsonArray users) {
		super.deleteUsers(users);
        //FIXME: anonymization is not relevant
        // Users are already deleted in Graph - Control and delete communities with no managers
		JsonObject params = new JsonObject().put("type", "manager");
		String query = "MATCH (c:Community)<-[:DEPENDS]-(gm:CommunityGroup {type : $type}) "
					 + "OPTIONAL MATCH (gm)<-[:IN]-(um:User) "
					 + "WITH c, c.pageId as pageId, gm, COUNT(um) AS managers WHERE managers = 0 "
					 + "OPTIONAL MATCH (c)<-[:DEPENDS]-(g:CommunityGroup) "
					 + "DETACH DELETE c, g "
					 + "RETURN DISTINCT pageId";
		neo4j.execute(query, params, validResultHandler(new Handler<Either<String, JsonArray>>(){
			@Override
			public void handle(Either<String, JsonArray> event) {
				if (event.isRight()) {
					JsonArray pageIds = event.right().getValue();
					for (Object o : pageIds) {
						if (!(o instanceof JsonObject)) continue;
						JsonObject page = (JsonObject) o;
						if (!page.containsKey("pageId")) continue;

						// Delete the page
						JsonObject deletePage = new JsonObject()
							.put("action", "delete")
							.put("pageId", page.getString("pageId"))
							.put("deleteResources", true);
						eb.send("communityPages", deletePage);
					}
					log.info("Deleted communities (community, page and resources) : " + pageIds.getList().toString());
				}
				else {
					log.error("Failed to delete communities : " + event.left().getValue());
				}
			}
		}));
	}

}
