# api/urls.py  (mounted at /api/ in core/urls.py)
from django.urls import path
from api.views import auth, hpc_users as users, qos, accounts, cluster

urlpatterns = [
    # auth
    path('login/', auth.login_view),
    path('logout/', auth.logout_view),
    path('token/refresh/', auth.refresh_view),

    # HPC users
    path('hpc-users/', users.users_collection),                                  # GET list, POST create
    path('hpc-users/<str:username>/', users.user_detail),                        # GET detail, DELETE
    path('hpc-users/<str:username>/qos/', users.user_qos),                       # POST add, DELETE remove
    path('hpc-users/<str:username>/default-qos/', users.user_default_qos),       # POST
    path('hpc-users/<str:username>/accounts/', users.user_accounts),             # POST add
    path('hpc-users/<str:username>/accounts/<str:account>/', users.user_account_detail),  # DELETE
    path('hpc-users/<str:username>/default-account/', users.user_default_account),        # POST
    path('hpc-users/<str:username>/quota/', users.user_quota),                   # PUT
    path('hpc-users/<str:username>/reset-password/', users.user_reset_password), # POST

    # QoS
    path('qos/', qos.qos_collection),                  # GET list, POST create
    path('qos/<str:name>/', qos.qos_detail),           # PATCH update, DELETE

    # accounts
    path('accounts/', accounts.accounts_collection),   # GET list, POST create
    path('accounts/<str:name>/', accounts.account_detail),  # DELETE

    # cluster
    path('cluster/nodes/', cluster.node_status),
    path('cluster/jobs/', cluster.running_jobs),
]
