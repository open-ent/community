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

package net.atos.entng.community.services.impl;

import fr.wseduc.mongodb.MongoDb;
import fr.wseduc.mongodb.MongoQueryBuilder;
import fr.wseduc.mongodb.MongoUpdateBuilder;
import fr.wseduc.webutils.Either;
import net.atos.entng.community.services.CommunityService;

import org.bson.conversions.Bson;
import org.entcore.common.mongodb.MongoDbConf;
import org.entcore.common.mongodb.MongoDbResult;
import org.entcore.common.neo4j.Neo4j;
import org.entcore.common.neo4j.StatementsBuilder;
import org.entcore.common.user.UserInfos;
import io.vertx.core.Handler;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.entcore.common.validation.StringValidation;

import java.util.*;

import static com.mongodb.client.model.Filters.eq;
import static org.entcore.common.neo4j.Neo4jResult.validEmptyHandler;
import static org.entcore.common.neo4j.Neo4jResult.validResultHandler;
import static org.entcore.common.neo4j.Neo4jResult.validUniqueResultHandler;
import static org.entcore.common.neo4j.Neo4jUtils.nodeSetPropertiesFromJson;

public class DefaultCommunityService implements CommunityService {

	private Neo4j neo4j = Neo4j.getInstance();
	private MongoDb mongo = MongoDb.getInstance();
	private MongoDbConf conf = MongoDbConf.getInstance();

	@Override
	public void create(JsonObject data, UserInfos user, Handler<Either<String, JsonObject>> handler) {
		String query =
				"CREATE (c:Community $props), " +
				"(c)<-[:DEPENDS]-(cr:CommunityGroup:Group:Visible {name : c.name + '-read', type : 'read', displayNameSearchField: $dnsf, filter : 'CommunityRead'}), " +
				"(c)<-[:DEPENDS]-(cc:CommunityGroup:Group:Visible {name : c.name + '-contrib', type : 'contrib', users : '', displayNameSearchField: $dnsf, filter : 'CommunityContrib'}), " +
				"(c)<-[:DEPENDS]-(cm:CommunityGroup:Group:Visible {name : c.name + '-manager', type : 'manager', users : '', displayNameSearchField: $dnsf, filter : 'CommunityManager'}) " +
				"SET cr.id = id(cr)+'-'+timestamp(), " +
				"cc.id = id(cc)+'-'+timestamp(), cm.id = id(cm)+'-'+timestamp(), cc.communiqueWith = [cm.id,cr.id], cm.communiqueWith = [cc.id,cr.id] " +
				"WITH c, cm, cr, cc " +
				"MATCH (u:User {id : $userId}) " +
				"CREATE (u)-[:IN]->(cm), (u)-[:COMMUNIQUE]->(cm), " +
				"(cc)-[:COMMUNIQUE]->(cr), (cc)-[:COMMUNIQUE]->(cm), " +
				"(cm)-[:COMMUNIQUE]->(cr), (cm)-[:COMMUNIQUE]->(cc) " +
				"RETURN c.id as id, cr.id as read, cc.id as contrib, cm.id as manager";
		final String dnsf = (data.getString("name") != null ? sanitize(data.getString("name")) : "");
		JsonObject params = new JsonObject()
				.put("userId", user.getUserId())
				.put("props", data.put("id", UUID.randomUUID().toString()))
				.put("dnsf", dnsf);
		neo4j.execute(query, params, validUniqueResultHandler(handler));
	}

	@Override
	public void update(String id, JsonObject data, Handler<Either<String, JsonObject>> handler) {
		String name = data.getString("name");
		String query;
		if (name != null && !name.trim().isEmpty()) {
			query = "MATCH (c:Community { id : $id})<-[:DEPENDS]-(g:CommunityGroup) " +
					"SET " + nodeSetPropertiesFromJson("c", data) +
					", g.name = $name + '-' + LAST(SPLIT(g.name, '-')), g.displayNameSearchField = $dnsf " +
					"RETURN DISTINCT c.id as id, c.pageId as pageId";
			data.put("dnsf", sanitize(name));
		} else {
			query = "MATCH (c:Community { id : $id}) " +
					"SET " + nodeSetPropertiesFromJson("c", data) + " " +
					"RETURN c.id as id";
		}
		data.put("id", id);
		neo4j.execute(query, data, validUniqueResultHandler(handler));
	}

	public static String sanitize(String field) {
		return StringValidation.removeAccents(field)
				.replaceAll("\\s+", "")
				.replaceAll("\\-","")
				.replaceAll("'","")
				.toLowerCase();
	}

	@Override
	public void delete(String id, Handler<Either<String, JsonObject>> handler) {
		StatementsBuilder sb = new StatementsBuilder();
		JsonObject params = new JsonObject().put("id", id);
		sb.add("MATCH (c:Community { id : $id}) RETURN c.pageId as pageId", params);
		String query =
				"MATCH (c:Community { id : $id})<-[r:DEPENDS]-(g:CommunityGroup) " +
				"OPTIONAL MATCH (g)<-[r2:IN|COMMUNIQUE]-() " +
				"DELETE c, r, g, r2 ";
		sb.add(query, params);
		neo4j.executeTransaction(sb.build(), null, true, validUniqueResultHandler(0, handler));
	}

	@Override
	public void list(UserInfos user, Handler<Either<String, JsonArray>> handler) {
		String query =
				"MATCH (u:User {id : $userId})-[:IN]->(g:CommunityGroup)-[:DEPENDS]->(c:Community) " +
				"RETURN c.id as id, c.name as name, c.description as description, " +
				"c.icon as icon, c.pageId as pageId, COLLECT(g.type) as types, COLLECT(distinct {id: g.id, type: g.type, name: g.name}) as groups ";
		JsonObject params = new JsonObject().put("userId", user.getUserId());
		neo4j.execute(query, params, validResultHandler(handler));
	}

	@Override
	public void get(String id, UserInfos user, Handler<Either<String,JsonObject>> handler) {
		String query =
				"MATCH (u:User {id : $userId})-[:IN]->(g:CommunityGroup)-[:DEPENDS]->(c:Community {id: $id}) " +
				"RETURN c.id as id, c.name as name, c.description as description, " +
				"c.icon as icon, c.pageId as pageId, COLLECT(g.type) as types, COLLECT(distinct {id: g.id, type: g.type, name: g.name}) as groups ";
		JsonObject params = new JsonObject().put("userId", user.getUserId()).put("id", id);
		neo4j.execute(query, params, validUniqueResultHandler(handler));
	};

	@Override
	public void get(String id, Handler<Either<String,JsonObject>> handler) {
		String query =
				"MATCH (c:Community {id: $id})-[:DEPENDS]-(g:CommunityGroup) " +
				"RETURN c.id as id, c.name as name, c.description as description, " +
				"c.icon as icon, c.pageId as pageId, COLLECT(g.type) as types, " +
				"COLLECT(distinct {id: g.id, type: g.type, name: g.name}) as groups ";
		JsonObject params = new JsonObject().put("id", id);
		neo4j.execute(query, params, validUniqueResultHandler(handler));
	}

	@Override
	public void manageUsers(String id, JsonObject users, Handler<Either<String, JsonObject>> handler) {
		StatementsBuilder sb = new StatementsBuilder();
		JsonObject params = new JsonObject().put("id", id);

		final Set<String> allUser = new HashSet<>();
		for (String attr : users.fieldNames()) {
			allUser.addAll(users.getJsonArray(attr, new JsonArray()).getList());
		}

		//delete all relation and recreate
		final String deleteQuery =
				"MATCH (c:Community {id : $id})<-[:DEPENDS]-(:CommunityGroup)<-[r:IN|COMMUNIQUE]-(u:User) " +
						"WHERE u.id IN $delete " +
						"DELETE r";
		sb.add(deleteQuery, params.copy().put("delete", new JsonArray(new ArrayList<Object>(allUser))));

		final String query =
				"MATCH (c:Community {id : $id})<-[:DEPENDS]-(g:CommunityGroup {type: $type}), (u:User) " +
						"WHERE u.id IN $users " +
						"MERGE (g)<-[:IN]-(u)";

		users.remove("delete");
		for (String attr : users.fieldNames()) {
			String q = ("contrib".equals(attr) || "manager".equals(attr)) ?
					query + " MERGE (g)<-[:COMMUNIQUE]-(u)" : query;
			sb.add(q, params.copy().put("type", attr).put("users", users.getJsonArray(attr)));
		}
		final String query0 = "MATCH (c:Community {id : $id})<-[:DEPENDS]-(g:CommunityGroup) SET g.nbUsers = 0;";
		sb.add(query0, params);
		final String queryNb =
				"MATCH (c:Community {id : $id})<-[:DEPENDS]-(g:CommunityGroup)<-[:IN]-(u:User) " +
				"WITH g, count(distinct u) as cu " +
				"SET g.nbUsers = cu;";
		sb.add(queryNb, params);
		neo4j.executeTransaction(sb.build(), null, true, validEmptyHandler(handler));
	}

	@Override
	public void listUsers(String id, final JsonArray types, final Handler<Either<String, JsonObject>> handler) {
		String query =
				"MATCH (:Community {id: $id})<-[:DEPENDS]-(:CommunityGroup {type : $type})<-[:IN]-(u:User) " +
				"RETURN u.id as id, u.displayName as displayName ";
		JsonObject params = new JsonObject().put("id", id);
		StatementsBuilder sb = new StatementsBuilder();
		for (Object o: types) {
			if (!(o instanceof String)) continue;
			sb.add(query, params.copy().put("type", o.toString()));
		}
		neo4j.executeTransaction(sb.build(), null, true, new Handler<Message<JsonObject>>() {
			@Override
			public void handle(Message<JsonObject> r) {
				if ("ok".equals(r.body().getString("status"))) {
					JsonArray results = r.body().getJsonArray("results");
					JsonObject res = new JsonObject();
					for (int i = 0; i < results.size(); i++) {
						res.put(types.getString(i), results.getJsonArray(i));
					}
					handler.handle(new Either.Right<String, JsonObject>(res));
				} else {
					handler.handle(new Either.Left<String, JsonObject>(r.body().getString("message")));
				}
			}
		});
	}

	@Override
	public void updateShare(String pageId, String userId, JsonObject value, Handler<Either<String, JsonObject>> handler) {
		JsonArray shared = new JsonArray();
		shared.add(new JsonObject().put("groupId", value.getString("read")).
				put("net-atos-entng-community-controllers-PagesController|get", true));
		shared.add(new JsonObject().put("groupId", value.getString("contrib")).
				put("net-atos-entng-community-controllers-PagesController|get", true).
				put("net-atos-entng-community-controllers-PagesController|update", true));
		shared.add(new JsonObject().put("groupId", value.getString("manager")).
				put("net-atos-entng-community-controllers-PagesController|get", true).
				put("net-atos-entng-community-controllers-PagesController|update", true).
				put("net-atos-entng-community-controllers-PagesController|delete", true));

		MongoUpdateBuilder updateQuery = new MongoUpdateBuilder().set("shared", shared);
		final Bson query = eq("_id", pageId);
		mongo.update(conf.getCollection(), MongoQueryBuilder.build(query), updateQuery.build(), MongoDbResult.validActionResultHandler(handler));
	}

}
