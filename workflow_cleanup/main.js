const { Octokit } = require("@octokit/rest");

const BATCH_LIMIT = 200;

const ENVIRONMENT = process.env;

const GITHUB_TOKEN = ENVIRONMENT.GITHUB_TOKEN;
const repository = ENVIRONMENT.REPOSITORY;
const beforeDateArg = ENVIRONMENT.BEFORE_DATE;

if(typeof repository != "string") {
  throw new Error(`The repository input parameter '${repository}' is not in the format {owner}/{repo}.`);
}

if(typeof beforeDateArg != "string") {
  throw new Error(`The before date input parameter '${beforeDateArg}' is invalid.`);
}

const ownerAndRepo = repository.split("/");
if(ownerAndRepo.length !== 2){
  throw new Error(`The repository input parameter '${repository}' is not in the format {owner}/{repo}.`);
}

const owner = ownerAndRepo[0];
const repoName = ownerAndRepo[1];

const dateCriteria = `<${beforeDateArg}`;

function requestWorkflowBatch(kit, owner, repo, dateQuery) {
  return kit.rest.actions.listWorkflowRunsForRepo({
    owner: owner,
    repo: repo,
    created: dateQuery,
    per_page: 50
  });
};

async function deleteWorkflowRun(kit, owner, repo, run) {
  let deleteParameters = {
    owner: owner,
    repo: repo,
    run_id: run.id
  };

  let { status } = await kit.actions.deleteWorkflowRun(deleteParameters);

  if(status == 204){
    console.log(`Deleted workflow run ${run.id}.`);
  }
  else{
    throw new Error(`Something went wrong while deleting workflow "${run.head_commit.message}" with ID:${run.id}. Status code: ${status}`);
  }
}

async function main(owner, repo, beforeDate) {

  const octokit = new Octokit({
    auth: GITHUB_TOKEN
  });

  let workflow_response = await requestWorkflowBatch(octokit, owner, repo, beforeDate);

  let runs = workflow_response.data.workflow_runs;

  let count = 0;

  while (runs.length > 0) {
    for (const workflowRun of runs) {
      if (count >= BATCH_LIMIT) {
        console.log(`We currently limit batch cleanup to ${BATCH_LIMIT} at a time - and we've hit it.`);
        return ;
      }
      await deleteWorkflowRun(octokit, owner, repo, workflowRun);
      count++;
    }
    workflow_response = await requestWorkflowBatch(octokit, owner, repo, beforeDate);
    runs = workflow_response.data.workflow_runs;
  }
};

main(owner, repoName, dateCriteria);