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

package net.atos.entng.community.controllers;

import static org.entcore.common.http.response.DefaultResponseHandler.arrayResponseHandler;
import static org.entcore.common.http.response.DefaultResponseHandler.defaultResponseHandler;
import static org.entcore.common.http.response.DefaultResponseHandler.leftToResponse;
import static org.entcore.common.http.response.DefaultResponseHandler.notEmptyResponseHandler;
import static org.entcore.common.user.UserUtils.getUserInfos;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import fr.wseduc.rs.*;
import io.vertx.core.AsyncResult;
import net.atos.entng.community.Community;
import net.atos.entng.community.services.CommunityService;

import org.entcore.common.events.EventHelper;
import org.entcore.common.notification.TimelineHelper;
import org.entcore.common.events.EventStore;
import org.entcore.common.events.EventStoreFactory;
import org.entcore.common.user.UserInfos;
import org.entcore.common.user.UserUtils;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.eventbus.Message;
import io.vertx.core.http.HttpServerRequest;
import org.vertx.java.core.http.RouteMatcher;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;


import fr.wseduc.rs.Delete;
import fr.wseduc.rs.Get;
import fr.wseduc.rs.Post;
import fr.wseduc.rs.Put;
import fr.wseduc.security.ActionType;
import fr.wseduc.security.SecuredAction;
import fr.wseduc.webutils.Either;
import fr.wseduc.webutils.I18n;
import fr.wseduc.webutils.http.BaseController;
import fr.wseduc.webutils.http.Renders;
import fr.wseduc.webutils.request.RequestUtils;

public class CommunityController extends BaseController {
	static final String RESOURCE_NAME = "community";
	private CommunityService communityService;
	private final TimelineHelper timeline;
	private static final JsonArray resourcesTypes = new JsonArray().add("read").add("contrib").add("manager");
	private EventHelper eventHelper;

	@Override
	public void init(Vertx vertx, JsonObject config, RouteMatcher rm,
			Map<String, fr.wseduc.webutils.security.SecuredAction> securedActions) {
		super.init(vertx, config, rm, securedActions);
		final EventStore eventStore = EventStoreFactory.getFactory().getEventStore(Community.class.getSimpleName());
		this.eventHelper = new EventHelper(eventStore);
	}

	public CommunityController(TimelineHelper helper) {
		timeline = helper;
	}

	@Get("")
	@SecuredAction("community.view")
	public void view(HttpServerRequest request) {
		// CCTP 51C — bascule AngularJS/React. Défaut piloté par la conf `frontend-ui`
		// (fallback "angular"), surchargée à la demande par `?ui=react|angular`.
		final String uiParam = request.params().get("ui");
		final String frontendUi = "react".equals(config.getString("frontend-ui", "angular")) ? "react" : "angular";
		final String ui = ("react".equals(uiParam) || "angular".equals(uiParam)) ? uiParam : frontendUi;
		if ("react".equals(ui)) {
			renderView(request, new JsonObject(), "community-react.html", null);
		} else {
			renderView(request);
		}

		// Create event "access to application Community" and store it, for module "statistics"
		eventHelper.onAccess(request);
	}

	@Post("")
	@SecuredAction("community.create")
	public void create(final HttpServerRequest request) {
		RequestUtils.bodyToJson(request, pathPrefix + "create", new Handler<JsonObject>() {
			@Override
			public void handle(final JsonObject body) {
				UserUtils.getUserInfos(eb, request, new Handler<UserInfos>() {
					@Override
					public void handle(final UserInfos user) {
						if (user != null) {
							CommunityController.this.create(user, request, body);
						} else {
							unauthorized(request);
						}
					}
				});
			}
		});
	}

	private void create(final UserInfos user, final HttpServerRequest request, final JsonObject body) {
		UserUtils.getSession(eb, request, new Handler<JsonObject>() {
			@Override
			public void handle(JsonObject u) {
				JsonObject p = new JsonObject()
						.put("title", body.getString("name"))
						.put("hideInPages", true)
						.put("pages", new JsonArray())
						.put("referencedResources", new JsonObject());
				JsonObject pages = new JsonObject()
						.put("action", "create")
						.put("user", u)
						.put("page", p);
				eb.request("communityPages", pages, new Handler<AsyncResult<Message<JsonObject>>>() {
					@Override
					public void handle(AsyncResult<Message<JsonObject>> message) {
						final JsonObject result = message.result().body().getJsonObject("result");
						if ("ok".equals(message.result().body().getString("status")) && result != null &&
								!result.getString("_id", "").trim().isEmpty()) {
							final String pageId = result.getString("_id");
							body.put("pageId", pageId);
							communityService.create(body, user, new Handler<Either<String, JsonObject>>() {
								@Override
								public void handle(final Either<String, JsonObject> r) {
									if (r.isRight()) {
										communityService.updateShare(pageId, user.getUserId(), r.right().getValue(), new Handler<Either<String, JsonObject>>(){
											public void handle(Either<String, JsonObject> event) {
												if (event.isLeft()){
													leftToResponse(request, event.left());
													eb.send("communityPages", new JsonObject().put("action", "delete")
															.put("pageId", pageId));
													return;
												}
												r.right().getValue().put("pageId", pageId);
												renderJson(request, r.right().getValue(), 201);
											}
										});
										createPageMarkups(pageId);
										eventHelper.onCreateResource(request, RESOURCE_NAME);
									} else {
										leftToResponse(request, r.left());
										eb.send("communityPages", new JsonObject().put("action", "delete")
												.put("pageId", pageId));
									}
								}
							});
						} else {
							renderError(request, message.result().body());
						}
					}
				});
			}
		});
	}


	private void createPageMarkups(String pageId) {
		JsonObject updatePage = new JsonObject()
		.put("action", "update")
		.put("pageId", pageId)
		.put("page", new JsonObject()
			.put("markups", new JsonObject()
				.put("view", new JsonArray()
					.add(new JsonObject()
						.put("label", "community.edit")
						.put("resourceRight", "share")
						.put("href", "/community#/edit/" + pageId))
					.add(new JsonObject()
						.put("label", "community.back.to")
						.put("resourceRight", "read")
						.put("href", "/community#/list")))));
		eb.request("communityPages", updatePage, new Handler<AsyncResult<Message<JsonObject>>>() {
			@Override
			public void handle(AsyncResult<Message<JsonObject>> message) {
				if (!"ok".equals(message.result().body().getString("status"))) {
					log.error(message.result().body().getString("message"));
				}
			}
		});
	}

	@Put("/:id")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void update(final HttpServerRequest request) {
		RequestUtils.bodyToJson(request, pathPrefix + "update", new Handler<JsonObject>() {
			@Override
			public void handle(JsonObject body) {
				if (body.size() > 0) {
					String name = body.getString("name");
					Handler<Either<String, JsonObject>> handler = (name != null && !name.trim().isEmpty()) ?
							updatePageHandler(request, name) : notEmptyResponseHandler(request);
					communityService.update(request.params().get("id"), body, handler);
				} else {
					badRequest(request, "empty.json");
				}
			}
		});
	}

	private Handler<Either<String, JsonObject>> updatePageHandler(final HttpServerRequest request, final String name) {
		return new Handler<Either<String, JsonObject>>() {
			@Override
			public void handle(final Either<String, JsonObject> r) {
				if (r.isRight()) {
					String pageId = r.right().getValue().getString("pageId");
					r.right().getValue().remove("pageId");
					JsonObject updatePage = new JsonObject()
							.put("action", "update")
							.put("pageId", pageId)
							.put("page", new JsonObject()
								.put("title", name)
								.put("hideInPages", true)
								.put("markups", new JsonObject()
								.put("view", new JsonArray()
									.add(new JsonObject()
										.put("label", "community.edit")
										.put("resourceRight", "share")
										.put("href", "/community#/edit/" + pageId))
									.add(new JsonObject()
										.put("label", "community.back.to")
										.put("resourceRight", "read")
										.put("href", "/community#/list")))));
					eb.request("communityPages", updatePage, new Handler<AsyncResult<Message<JsonObject>>>() {
						@Override
						public void handle(AsyncResult<Message<JsonObject>> message) {
							if (!"ok".equals(message.result().body().getString("status"))) {
								log.error(message.result().body().getString("message"));
							}
							renderJson(request, r.right().getValue());
						}
					});
				} else {
					leftToResponse(request, r.left());
				}
			}
		};
	}

	@Delete("/:id")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void delete(final HttpServerRequest request) {
		communityService.delete(request.params().get("id"), new Handler<Either<String, JsonObject>>() {
			@Override
			public void handle(Either<String, JsonObject> r) {
				if (r.isRight()) {
					JsonObject deletePage = new JsonObject()
							.put("action", "delete")
							.put("pageId", r.right().getValue().getString("pageId"))
							.put("deleteResources", true);
					eb.send("communityPages", deletePage);
					ok(request);
				} else {
					leftToResponse(request, r.left());
				}
			}
		});
	}

	@Get("/list")
	@SecuredAction(value = "", type = ActionType.AUTHENTICATED)
	public void list(final HttpServerRequest request) {
		UserUtils.getUserInfos(eb, request, new Handler<UserInfos>() {
			@Override
			public void handle(UserInfos user) {
				if (user != null) {
					communityService.list(user, arrayResponseHandler(request));
				} else {
					unauthorized(request);
				}
			}
		});
	}


	@Get("/:id/details")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void details(HttpServerRequest request) {
		communityService.get(request.params().get("id"), notEmptyResponseHandler(request));
	}

	@Put("/:id/users")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void manageUsers(final HttpServerRequest request) {
		final String id = request.params().get("id");
		RequestUtils.bodyToJson(request, pathPrefix + "manageUsers", new Handler<JsonObject>() {
			@Override
			public void handle(final JsonObject body) {
				if (body.size() > 0) {
					communityService.manageUsers(id, body, new Handler<Either<String, JsonObject>>() {
						@Override
						public void handle(Either<String, JsonObject> event) {
							if (event.isRight()) {
								UserUtils.getUserInfos(eb, request, new Handler<UserInfos>() {
									@Override
									public void handle(final UserInfos user) {
										communityService.get(id, user, new Handler<Either<String, JsonObject>>() {
											public void handle(Either<String, JsonObject> event) {
												if (event.isRight()) {
													//Populate notification parameters
													JsonObject params = new JsonObject()
															.put("resourceName", event.right().getValue().getString("name", ""))
															.put("resourceUri", "/community#/view/" + id)
															.put("uri", "/userbook/annuaire#" + user.getUserId() + "#" + user.getType())
															.put("username", user.getUsername());

													//Get user list
													ArrayList<String> readList = new ArrayList<>();
													ArrayList<String> contribList = new ArrayList<>();
													ArrayList<String> managerList = new ArrayList<>();
													for (String field : body.fieldNames()) {
														if ("read".equals(field))
															readList.addAll(body.getJsonArray(field).getList());
														else if ("contrib".equals(field))
															contribList.addAll(body.getJsonArray(field).getList());
														else if ("manager".equals(field))
															managerList.addAll(body.getJsonArray(field).getList());
													}

													if (readList.size() > 0) {
														timeline.notifyTimeline(request, "community.share", user, readList,
																request.params().get("id"), null, params.put("shareType", "read"), true);
													}
													if (contribList.size() > 0) {
														params.remove("shareType");
														timeline.notifyTimeline(request, "community.share", user, contribList,
																request.params().get("id"), null, params.put("shareType", "contrib"), true);
													}
													if (managerList.size() > 0) {
														params.remove("shareType");
														timeline.notifyTimeline(request, "community.share", user, managerList,
																request.params().get("id"), null, params.put("shareType", "manager"), true);
													}
												}
											}
										});
									}
								});
								Renders.renderJson(request, event.right().getValue(), 200);
							} else {
								JsonObject error = new JsonObject()
										.put("error", event.left().getValue());
								Renders.renderJson(request, error, 400);
							}
						}
					});
				} else {
					badRequest(request, "empty.json");
				}
			}
		});
	}

	@Get("/:id/users")
	@SecuredAction(value = "", type = ActionType.RESOURCE)
	public void listUsers(final HttpServerRequest request) {
		List<String> t = request.params().getAll("type");
		JsonArray types = (t != null && !t.isEmpty()) ?
				new JsonArray(t) : resourcesTypes; //new JsonArray(RightsController.allowedSharingRights.toArray());
		communityService.listUsers(request.params().get("id"), types, new Handler<Either<String, JsonObject>>() {
			@Override
			public void handle(final Either<String, JsonObject> event) {
				final Handler<Either<String, JsonObject>> handler = defaultResponseHandler(request);
				if (event.isRight()) {
					final JsonObject res = event.right().getValue();
					listVisible(request, I18n.acceptLanguage(request), new Handler<JsonObject>() {
						@Override
						public void handle(final JsonObject visibles) {
							res.put("visibles", visibles);
							handler.handle(event);
						}
					});
				} else {
					handler.handle(event);
				}
			}
		});
	}

	@Get("/visibles")
	@SecuredAction("community.listVisibles")
	public void listVisibles(final HttpServerRequest request) {
		listVisible(request, I18n.acceptLanguage(request), new Handler<JsonObject>() {
			@Override
			public void handle(final JsonObject visibles) {
				renderJson(request, visibles);
			}
		});
	}

	private void listVisible(final HttpServerRequest request, final String acceptLanguage, final Handler<JsonObject> handler) {
		getUserInfos(eb, request, new Handler<UserInfos>() {
			@Override
			public void handle(final UserInfos user) {
				final JsonObject visibles = new JsonObject();
				UserUtils.findVisibleUsers(eb, user.getUserId(), false, new Handler<JsonArray>() {
					@Override
					public void handle(JsonArray users) {
						if (users != null) {
							visibles.put("users", users);
						}
						UserUtils.findVisibleProfilsGroups(eb, user.getUserId(), new Handler<JsonArray>() {
							@Override
							public void handle(JsonArray groups) {
								if (groups != null) {
									for (Object g : groups) {
										if (!(g instanceof JsonObject)) continue;
										JsonObject group = (JsonObject) g;
										UserUtils.groupDisplayName(group, acceptLanguage);
									}
									visibles.put("groups", groups);
								}
								handler.handle(visibles);
							}
						});
					}
				});
			}
		});
	}

	public void setCommunityService(CommunityService communityService) {
		this.communityService = communityService;
	}

	@Get("/listallpages")
	@ApiDoc("List communities, visible by current user")
	@SecuredAction(value = "", type = ActionType.AUTHENTICATED)
	public void listAllPages(final HttpServerRequest request) {
		UserUtils.getUserInfos(eb, request, new Handler<UserInfos>() {
			@Override
			public void handle(final UserInfos user) {
				if (user != null) {
					Handler<Either<String, JsonArray>> handler = arrayResponseHandler(request);
					communityService.list(user, handler);
				}
			}
		});
	}

}
