import logging

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from seahub.project.agent_action_executor import (
    AgentActionExecutor,
    MappingRequiredError,
)
from seahub.project.models import Projects
from seahub.project.seadb_api import SeaDBAPI
from seahub.seadb_models.models import SchemaTables
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Process one pending agent action through auto-confirm execution.'

    def add_arguments(self, parser):
        parser.add_argument('--project-uuid', required=True, help='Project UUID')
        parser.add_argument('--action-id', required=True, type=int, help='Agent action row id')

    def handle(self, *args, **options):
        project_uuid = (options.get('project_uuid') or '').strip()
        action_id = options.get('action_id')
        if not project_uuid or not action_id:
            raise CommandError('Both --project-uuid and --action-id are required.')

        project = Projects.objects.get_project_by_uuid(project_uuid)
        if not project:
            raise CommandError(f'Project not found: {project_uuid}')

        seadb_api = SeaDBAPI()
        action = self._get_action(seadb_api, project_uuid, action_id)
        if not action:
            logger.warning('Auto action skipped, action %s not found.', action_id)
            return

        if (action.get('status') or '').strip() != 'pending':
            logger.info('Auto action skipped, action %s is not pending.', action_id)
            return

        tool_name = (action.get('tool_name') or '').strip()
        auto_confirm_map = AgentActionExecutor.get_effective_auto_confirm_map(project)
        if not auto_confirm_map.get(tool_name, False):
            logger.info('Auto action skipped, tool %s is not enabled for auto-confirm.', tool_name)
            return

        operator = AgentActionExecutor.resolve_auto_action_operator(project)
        if not operator:
            self._update_action_result(
                seadb_api,
                project_uuid,
                action_id,
                AgentActionExecutor.normalize_execution_result({
                    'success': False,
                    'result': 'No valid operator available for auto action execution.',
                }),
            )
            logger.warning('Auto action %s failed: no valid operator.', action_id)
            return

        self._update_action_status(seadb_api, project_uuid, action_id, {'status': 'executing'})

        executor = AgentActionExecutor()
        try:
            execution = executor.execute_action(
                seadb_api=seadb_api,
                project=project,
                project_uuid=project_uuid,
                action=action,
                operator=operator,
                request=None,
                auto_executed=True,
            )
        except MappingRequiredError as e:
            execution = AgentActionExecutor.normalize_execution_result({
                'success': False,
                'result': f'Mapping required for agent type: {e.agent_type}',
            })
        except Exception as e:
            logger.exception(
                'Auto action execution failed for action %s project %s: %s',
                action_id,
                project_uuid,
                e,
            )
            execution = AgentActionExecutor.normalize_execution_result({
                'success': False,
                'result': str(e) or 'Action execution failed.',
            })

        self._update_action_result(seadb_api, project_uuid, action_id, execution)

    def _get_action(self, seadb_api, project_uuid, action_id):
        sql = (
            "SELECT `_pk`, `run_id`, `status`, `tool_name`, `source_type`, `source_id`, "
            "`suggestion_text`, `suggestion_content` "
            f"FROM `{SchemaTables.AGENT_ACTIONS.table_name()}` WHERE `_pk` = {int(action_id)} LIMIT 1"
        )
        result = seadb_api.query_rows(project_uuid, sql)
        rows = result.get('results', [])
        return rows[0] if rows else None

    def _update_action_result(self, seadb_api, project_uuid, action_id, execution):
        now = timezone.now().isoformat()
        self._update_action_status(seadb_api, project_uuid, action_id, {
            'status': execution.get('status', 'failed'),
            'result': execution.get('result', 'Action execution failed.'),
            'executed_at': now,
        })

    def _update_action_status(self, seadb_api, project_uuid, action_id, row):
        update_data = [{
            'pk': int(action_id),
            'row': row,
        }]
        seadb_api.update_rows(project_uuid, SchemaTables.AGENT_ACTIONS.table_name(), update_data)
